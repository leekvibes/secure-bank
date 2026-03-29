import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readAndDecryptFile, encryptAndSaveFile } from "@/lib/files";
import { apiError, apiSuccess } from "@/lib/api-response";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// ── NEW FLOW: lookup by DocSignRecipient.token ────────────────────────────────

async function handleNewFlow(
  req: NextRequest,
  token: string
): Promise<Response | null> {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token },
    include: {
      request: {
        include: {
          agent: { select: { displayName: true, agencyName: true } },
          pages: { orderBy: { page: "asc" } },
          recipients: {
            select: { id: true, status: true, order: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!recipient) return null; // fall through to legacy

  const request = recipient.request;

  if (request.status === "VOIDED") {
    return apiError(410, "VOIDED", "This document has been voided.");
  }
  if (request.expiresAt < new Date()) {
    return apiError(410, "EXPIRED", "This signing link has expired.");
  }
  if (recipient.status === "COMPLETED") {
    return apiError(409, "ALREADY_SIGNED", "You have already signed this document.");
  }
  if (recipient.status === "DECLINED") {
    return apiError(410, "DECLINED", "You have declined to sign this document.");
  }

  // Sequential: verify it is this recipient's turn
  if (request.signingMode === "SEQUENTIAL") {
    const completedOrders = request.recipients
      .filter((r) => r.status === "COMPLETED")
      .map((r) => r.order);
    const maxCompleted =
      completedOrders.length > 0 ? Math.max(...completedOrders) : -1;
    if (recipient.order > maxCompleted + 1) {
      return apiError(
        409,
        "NOT_YOUR_TURN",
        "It is not yet your turn to sign. You will receive an email when previous signers have completed."
      );
    }
  }

  // Capture IP / UA
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;

  // Mark as OPENED on first visit
  if (recipient.status === "PENDING") {
    await db.docSignRecipient.update({
      where: { id: recipient.id },
      data: { status: "OPENED", openedAt: new Date(), ipAddress: ip, userAgent: ua },
    });
    if (request.status === "SENT") {
      await db.docSignRequest.update({
        where: { id: request.id },
        data: { status: "OPENED" },
      });
    }
    await db.docSignAuditLog.create({
      data: {
        requestId: request.id,
        event: "OPENED",
        ipAddress: ip,
        userAgent: ua,
        recipientId: recipient.id,
      },
    });
  }

  // Load fields assigned to this recipient only
  const fields = await db.docSignField.findMany({
    where: { requestId: request.id, recipientId: recipient.id },
    orderBy: [{ page: "asc" }, { y: "asc" }],
  });

  const completedCount = request.recipients.filter(
    (r) => r.status === "COMPLETED"
  ).length;

  return apiSuccess({
    _flow: "new",
    recipient: {
      id: recipient.id,
      name: recipient.name,
      email: recipient.email,
      status:
        recipient.status === "PENDING" ? "OPENED" : recipient.status,
      order: recipient.order,
    },
    request: {
      id: request.id,
      title: request.title,
      message: request.message,
      blobUrl: request.blobUrl,
      documentHash: request.documentHash,
      expiresAt: request.expiresAt.toISOString(),
      signingMode: request.signingMode,
    },
    agent: {
      displayName: request.agent.displayName,
      agencyName: request.agent.agencyName,
    },
    pages: request.pages,
    fields: fields.map((f) => ({
      id: f.id,
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
      options: f.options ? JSON.parse(f.options) : null,
    })),
    totalRecipients: request.recipients.length,
    completedCount,
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Try new recipient flow first
  const newFlowResponse = await handleNewFlow(req, params.token);
  if (newFlowResponse) return newFlowResponse;

  // ── Legacy flow: DocSignRequest.token ──────────────────────────────────────
  const doc = await db.docSignRequest.findUnique({
    where: { token: params.token },
    include: { agent: { select: { displayName: true, agencyName: true } } },
  });

  if (!doc) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (doc.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "This document has already been signed.");
  if (doc.status === "EXPIRED" || doc.expiresAt < new Date())
    return apiError(410, "EXPIRED", "This signing link has expired.");

  if (doc.status === "SENT") {
    await db.docSignRequest.update({
      where: { token: params.token },
      data: { status: "OPENED" },
    });
    await db.docSignAuditLog.create({
      data: { requestId: doc.id, event: "OPENED" },
    });
  }

  return apiSuccess({
    _flow: "legacy",
    id: doc.id,
    title: doc.title,
    message: doc.message,
    clientName: doc.clientName,
    expiresAt: doc.expiresAt.toISOString(),
    fields: doc.fieldsJson ? JSON.parse(doc.fieldsJson) : [],
    agentSignData: doc.agentSignJson ? JSON.parse(doc.agentSignJson) : null,
    agent: doc.agent,
    originalName: doc.originalName,
  });
}

// ── HEAD (legacy: serve PDF bytes) ───────────────────────────────────────────

export async function HEAD(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const doc = await db.docSignRequest.findUnique({
    where: { token: params.token },
    select: {
      originalFilePath: true,
      originalName: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!doc) return new Response(null, { status: 404 });
  const fileBuffer = await readAndDecryptFile(doc.originalFilePath);
  const isPdf = doc.originalName?.toLowerCase().endsWith(".pdf") ?? true;
  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}

// ── Legacy types ──────────────────────────────────────────────────────────────

interface SignField {
  id: string;
  type: "SIGNATURE" | "INITIALS" | "DATE" | "NAME";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo: "AGENT" | "CLIENT";
  value?: string;
}

// ── POST (legacy flow) ────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const doc = await db.docSignRequest.findUnique({
    where: { token: params.token },
    include: { agent: { select: { displayName: true, email: true } } },
  });

  if (!doc) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (doc.status === "COMPLETED") return apiError(409, "ALREADY_SIGNED", "Already signed.");
  if (doc.expiresAt < new Date()) return apiError(410, "EXPIRED", "Link expired.");

  let body: { fields: SignField[] };
  try {
    body = await req.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const clientFields = (body.fields ?? []).filter((f) => f.assignedTo === "CLIENT");
  const required = (
    doc.fieldsJson ? (JSON.parse(doc.fieldsJson) as SignField[]) : []
  ).filter((f) => f.assignedTo === "CLIENT");

  for (const rf of required) {
    const filled = clientFields.find((f) => f.id === rf.id);
    if (!filled?.value?.trim()) {
      return apiError(422, "MISSING_FIELDS", "Please complete all required fields.");
    }
  }

  const agentFields: SignField[] = doc.agentSignJson
    ? JSON.parse(doc.agentSignJson)
    : [];
  const allFields: SignField[] = [
    ...agentFields,
    ...clientFields.map((cf) => {
      const match = (
        doc.fieldsJson ? (JSON.parse(doc.fieldsJson) as SignField[]) : []
      ).find((f) => f.id === cf.id);
      return { ...(match ?? cf), value: cf.value };
    }),
  ];

  const originalBytes = await readAndDecryptFile(doc.originalFilePath);
  let signedBytes: Buffer;

  try {
    const isPdf = doc.originalName?.toLowerCase().endsWith(".pdf") ?? true;
    if (isPdf) {
      const pdfDoc = await PDFDocument.load(originalBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      for (const field of allFields) {
        if (!field.value?.trim()) continue;
        const page = pages[field.page] ?? pages[0];
        const { width: pw, height: ph } = page.getSize();
        const px = field.x * pw;
        const py = ph - field.y * ph - field.height * ph;
        const fontSize =
          field.type === "SIGNATURE" ? 14 : field.type === "INITIALS" ? 13 : 11;
        const color =
          field.type === "SIGNATURE" || field.type === "INITIALS"
            ? rgb(0, 0, 0.6)
            : rgb(0.2, 0.2, 0.2);
        page.drawText(field.value.trim(), { x: px + 4, y: py + 6, font, size: fontSize, color });
        if (field.type === "SIGNATURE" || field.type === "INITIALS") {
          page.drawLine({
            start: { x: px, y: py },
            end: { x: px + field.width * pw, y: py },
            thickness: 1,
            color: rgb(0, 0, 0.5),
          });
        }
      }

      signedBytes = Buffer.from(await pdfDoc.save());
    } else {
      signedBytes = originalBytes;
    }
  } catch {
    signedBytes = originalBytes;
  }

  const signedFilePath = await encryptAndSaveFile(Buffer.from(signedBytes));
  const completedAt = new Date();

  await db.docSignRequest.update({
    where: { token: params.token },
    data: { status: "COMPLETED", completedAt, signedFilePath, agentSignJson: JSON.stringify(agentFields) },
  });

  await db.docSignAuditLog.create({
    data: {
      requestId: doc.id,
      event: "COMPLETED",
      metadata: JSON.stringify({
        fieldsCompleted: clientFields.length,
        completedAt: completedAt.toISOString(),
      }),
    },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
  try {
    const { sendDocSignCompletedEmail } = await import("@/lib/email");
    sendDocSignCompletedEmail({
      agentEmail: doc.agent.email,
      agentName: doc.agent.displayName,
      clientName: doc.clientName,
      title: doc.title,
      completedAt: completedAt.toLocaleString("en-US", { timeZone: "America/New_York" }),
      viewUrl: `${appUrl}/dashboard/docsign/${doc.id}`,
    });
  } catch {
    /* non-critical */
  }

  return apiSuccess({ success: true }, 201);
}
