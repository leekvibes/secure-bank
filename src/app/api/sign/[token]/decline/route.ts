import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";
import {
  DECLINE_REASON_CODES,
  DECLINE_REASON_LABELS,
} from "@/lib/signing/decline-reasons";

const schema = z.object({
  reasonCode: z.enum(DECLINE_REASON_CODES).optional(),
  reasonText: z.string().max(500).optional(),
  // Backward compat with older clients.
  reason: z.string().max(500).optional(),
});

// POST /api/sign/[token]/decline
// Recipient declines to sign. Voids the entire request and notifies the agent.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: {
        include: {
          agent: { select: { displayName: true, email: true } },
        },
      },
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (recipient.request.status === "VOIDED")
    return apiError(410, "VOIDED", "This document has already been voided.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already signed this document.");
  if (recipient.status === "DECLINED")
    return apiError(409, "ALREADY_DECLINED", "You have already declined.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "BAD_REQUEST", "Invalid decline reason payload.");
  }

  const reasonText =
    parsed.data.reasonText?.trim() ??
    parsed.data.reason?.trim() ??
    "";
  const normalizedReasonText = reasonText.length > 0 ? reasonText : null;
  const reasonCode = parsed.data.reasonCode ?? (normalizedReasonText ? "OTHER" : "NO_REASON_GIVEN");

  if (reasonCode === "OTHER" && !normalizedReasonText) {
    return apiError(400, "BAD_REQUEST", "Please provide a reason when selecting Other.");
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;

  const now = new Date();
  const reasonLabel = DECLINE_REASON_LABELS[reasonCode];
  const declineSummary = normalizedReasonText
    ? `${reasonLabel}: ${normalizedReasonText}`
    : reasonLabel;

  await db.$transaction([
    db.docSignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "DECLINED",
        declinedAt: now,
        declineReason: normalizedReasonText,
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
      },
    }),
    db.docSignRequest.update({
      where: { id: recipient.requestId },
      data: {
        status: "VOIDED",
        voidedAt: now,
        voidReason: `Declined by ${recipient.name}${declineSummary ? `: ${declineSummary}` : ""}`,
      },
    }),
    db.docSignAuditLog.create({
      data: {
        requestId: recipient.requestId,
        event: "DECLINED",
        ipAddress: ip,
        userAgent: ua,
        recipientId: recipient.id,
        metadata: JSON.stringify({
          reasonCode,
          reasonLabel,
          reasonText: normalizedReasonText,
        }),
      },
    }),
    db.docSignAuditLog.create({
      data: {
        requestId: recipient.requestId,
        event: "VOIDED",
        ipAddress: ip,
        metadata: JSON.stringify({
          reason: `Declined by ${recipient.name}`,
          reasonCode,
          reasonLabel,
        }),
      },
    }),
  ]);

  // Notify agent
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
  const request = recipient.request;
  try {
    const { sendDocSignDeclinedEmail } = await import("@/lib/email");
    sendDocSignDeclinedEmail({
      agentEmail: request.agent.email,
      agentName: request.agent.displayName,
      recipientName: recipient.name,
      title: request.title,
      declineReasonCode: reasonCode,
      declineReason: normalizedReasonText,
      viewUrl: `${baseUrl}/dashboard/signing/${recipient.requestId}`,
    }).catch(() => {});
  } catch {
    /* non-critical */
  }

  return apiSuccess({ declined: true, reasonCode, reasonText: normalizedReasonText });
}
