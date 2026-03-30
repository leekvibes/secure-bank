import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";

const fieldValueSchema = z.object({
  id: z.string().min(1),
  value: z.string(), // text, "true"/"false", or base64 PNG data URI
});

const schema = z.object({
  fields: z.array(fieldValueSchema).max(200),
});

// POST /api/sign/[token]/complete
// Called when a recipient submits all their field values.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: {
        include: {
          agent: { select: { id: true, displayName: true, email: true } },
          recipients: { orderBy: { order: "asc" } },
          pages: true,
        },
      },
      fields: true,
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (recipient.request.status === "VOIDED")
    return apiError(410, "VOIDED", "This document has been voided.");
  if (recipient.request.expiresAt < new Date())
    return apiError(410, "EXPIRED", "This signing link has expired.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already signed this document.");
  if (!recipient.consentAt)
    return apiError(400, "NO_CONSENT", "Consent must be recorded before signing.");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
  }

  const { fields: submittedValues } = parsed.data;
  const valueMap = new Map(submittedValues.map((v) => [v.id, v.value]));

  // Validate all required fields are present
  for (const field of recipient.fields) {
    if (!field.required) continue;
    const val = valueMap.get(field.id);
    if (!val?.trim()) {
      return apiError(
        422,
        "MISSING_FIELDS",
        `Required field of type ${field.type} is missing.`
      );
    }
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;

  const completedAt = new Date();

  // Persist field values + mark recipient complete in a transaction
  await db.$transaction([
    // Save each field value
    ...recipient.fields.map((f) => {
      const val = valueMap.get(f.id) ?? "";
      return db.docSignField.update({
        where: { id: f.id },
        data: { value: val, completedAt: val ? completedAt : null },
      });
    }),
    // Mark recipient complete
    db.docSignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "COMPLETED",
        completedAt,
        ipAddress: ip ?? recipient.ipAddress,
        userAgent: ua ?? recipient.userAgent,
      },
    }),
    // Audit event
    db.docSignAuditLog.create({
      data: {
        requestId: recipient.requestId,
        event: "RECIPIENT_SIGNED",
        ipAddress: ip,
        userAgent: ua,
        recipientId: recipient.id,
        metadata: JSON.stringify({ fieldsCompleted: recipient.fields.length }),
      },
    }),
  ]);

  const request = recipient.request;

  // Re-fetch all recipients to check completion state
  const allRecipients = await db.docSignRecipient.findMany({
    where: { requestId: request.id },
    orderBy: { order: "asc" },
  });

  const allDone = allRecipients.every((r) =>
    r.id === recipient.id ? true : r.status === "COMPLETED"
  );

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

  if (!allDone && request.signingMode === "SEQUENTIAL") {
    // Notify the next pending recipient
    const nextRecipient = allRecipients.find(
      (r) => r.status !== "COMPLETED" && r.status !== "DECLINED" && r.id !== recipient.id
    );
    if (nextRecipient) {
      const { sendDocSignRequestEmail } = await import("@/lib/email");
      sendDocSignRequestEmail({
        toEmail: nextRecipient.email,
        agentName: request.agent.displayName,
        title: request.title,
        message: request.message,
        signUrl: `${baseUrl}/sign/${nextRecipient.token}`,
        expiresAt: request.expiresAt,
      }).catch(() => {});
    }
  }

  if (allDone) {
    // Trigger PDF assembly + Certificate generation
    try {
      const { assemblePdf, generateCertificate } = await import(
        "@/lib/signing/pdf-assembly"
      );

      // Collect all field values across all recipients
      const allFields = await db.docSignField.findMany({
        where: { requestId: request.id },
        orderBy: [{ page: "asc" }, { y: "asc" }],
      });

      const fieldValues = allFields
        .filter((f) => f.value)
        .map((f) => ({
          id: f.id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          value: f.value!,
        }));

      const pageDims = request.pages.map((p) => ({
        page: p.page,
        widthPts: p.widthPts,
        heightPts: p.heightPts,
      }));

      // Assemble signed PDF
      const assemblyResult = request.blobUrl
        ? await assemblePdf(request.blobUrl, fieldValues, pageDims, request.documentHash ?? undefined)
        : null;
      const signedBlobUrl = assemblyResult?.url ?? null;
      const signedDocumentHash = assemblyResult?.hash ?? null;

      // Build audit events for certificate
      const auditEvents = await db.docSignAuditLog.findMany({
        where: { requestId: request.id },
        orderBy: { createdAt: "asc" },
      });

      const recipientSummaries = allRecipients.map((r) => ({
        name: r.name,
        email: r.email,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        consentAt: r.consentAt,
        completedAt: r.completedAt,
        declinedAt: r.declinedAt,
      }));

      const certUrl = await generateCertificate(
        request.id,
        request.title,
        request.documentHash,
        request.agent.displayName,
        recipientSummaries,
        auditEvents.map((e) => ({
          event: e.event,
          ipAddress: e.ipAddress,
          recipientId: e.recipientId,
          metadata: e.metadata,
          createdAt: e.createdAt,
        })),
        completedAt
      );

      // Persist completion state
      await db.$transaction([
        db.docSignRequest.update({
          where: { id: request.id },
          data: {
            status: "COMPLETED",
            completedAt,
            ...(signedBlobUrl ? { signedBlobUrl } : {}),
            signedDocumentHash,
          },
        }),
        db.docSignAuditLog.create({
          data: {
            requestId: request.id,
            event: "COMPLETED",
            metadata: JSON.stringify({ allSigned: true }),
          },
        }),
        db.certificateOfCompletion.create({
          data: { requestId: request.id, blobUrl: certUrl },
        }),
      ]);

      // Email agent: all signed
      const viewUrl = `${baseUrl}/dashboard/signing/${request.id}`;
      const { sendDocSignAllSignedEmail, sendDocSignRecipientCopyEmail } =
        await import("@/lib/email");

      sendDocSignAllSignedEmail({
        agentEmail: request.agent.email,
        agentName: request.agent.displayName,
        title: request.title,
        completedAt: completedAt.toLocaleString("en-US", {
          timeZone: "America/New_York",
        }),
        viewUrl,
        signedPdfUrl: signedBlobUrl ?? undefined,
        certUrl,
      }).catch(() => {});

      // Email each recipient their copy
      if (signedBlobUrl) {
        for (const r of allRecipients) {
          sendDocSignRecipientCopyEmail({
            toEmail: r.email,
            recipientName: r.name,
            agentName: request.agent.displayName,
            title: request.title,
            signedPdfUrl: signedBlobUrl,
            certUrl,
          }).catch(() => {});
        }
      }

      return apiSuccess({ success: true, allSigned: true, certUrl, signedBlobUrl });
    } catch (err) {
      console.error("[sign/complete] PDF assembly failed:", err);
      // Still mark completed even if assembly fails
      await db.docSignRequest.update({
        where: { id: request.id },
        data: { status: "COMPLETED", completedAt },
      }).catch(() => {});

      return apiSuccess({ success: true, allSigned: true, assemblyError: true });
    }
  }

  return apiSuccess({ success: true, allSigned: false });
}
