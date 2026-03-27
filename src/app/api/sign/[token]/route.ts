import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readAndDecryptFile, encryptAndSaveFile } from "@/lib/files";
import { apiError, apiSuccess } from "@/lib/api-response";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// GET: load document config for the signing page
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const doc = await db.docSignRequest.findUnique({
    where: { token: params.token },
    include: { agent: { select: { displayName: true, agencyName: true } } },
  });

  if (!doc) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (doc.status === "COMPLETED") return apiError(409, "ALREADY_SIGNED", "This document has already been signed.");
  if (doc.status === "EXPIRED" || doc.expiresAt < new Date()) return apiError(410, "EXPIRED", "This signing link has expired.");

  // Mark as opened
  if (doc.status === "SENT") {
    await db.docSignRequest.update({ where: { token: params.token }, data: { status: "OPENED" } });
    await db.docSignAuditLog.create({ data: { requestId: doc.id, event: "OPENED" } });
  }

  return apiSuccess({
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

// GET file content — serve the decrypted PDF/image
export async function HEAD(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const doc = await db.docSignRequest.findUnique({
    where: { token: params.token },
    select: { originalFilePath: true, originalName: true, status: true, expiresAt: true },
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

interface SignField {
  id: string;
  type: "SIGNATURE" | "INITIALS" | "DATE" | "NAME";
  page: number;
  x: number; // 0–1 relative
  y: number; // 0–1 relative
  width: number;
  height: number;
  assignedTo: "AGENT" | "CLIENT";
  value?: string;
}

// POST: submit signed document
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
  try { body = await req.json(); } catch { return apiError(400, "BAD_REQUEST", "Invalid JSON."); }

  const clientFields = (body.fields ?? []).filter((f) => f.assignedTo === "CLIENT");
  const required = (doc.fieldsJson ? JSON.parse(doc.fieldsJson) as SignField[] : []).filter((f) => f.assignedTo === "CLIENT");

  for (const req of required) {
    const filled = clientFields.find((f) => f.id === req.id);
    if (!filled?.value?.trim()) {
      return apiError(422, "MISSING_FIELDS", `Please complete all required fields.`);
    }
  }

  // Merge agent + client fields
  const agentFields: SignField[] = doc.agentSignJson ? JSON.parse(doc.agentSignJson) : [];
  const allFields: SignField[] = [
    ...agentFields,
    ...clientFields.map((cf) => {
      const match = (doc.fieldsJson ? JSON.parse(doc.fieldsJson) as SignField[] : []).find((f) => f.id === cf.id);
      return { ...(match ?? cf), value: cf.value };
    }),
  ];

  // Embed into PDF
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
        const py = ph - (field.y * ph) - (field.height * ph); // PDF origin is bottom-left
        const fontSize = field.type === "SIGNATURE" ? 14 : field.type === "INITIALS" ? 13 : 11;
        const color = field.type === "SIGNATURE" || field.type === "INITIALS" ? rgb(0, 0, 0.6) : rgb(0.2, 0.2, 0.2);

        page.drawText(field.value.trim(), { x: px + 4, y: py + 6, font, size: fontSize, color });

        // Underline for signature/initials
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
      // Image — just store with signature overlay note; full canvas overlay is client-side
      signedBytes = originalBytes;
    }
  } catch {
    signedBytes = originalBytes;
  }

  const signedFilePath = await encryptAndSaveFile(Buffer.from(signedBytes));
  const completedAt = new Date();

  await db.docSignRequest.update({
    where: { token: params.token },
    data: {
      status: "COMPLETED",
      completedAt,
      signedFilePath,
      agentSignJson: JSON.stringify(agentFields),
    },
  });

  await db.docSignAuditLog.create({
    data: {
      requestId: doc.id,
      event: "COMPLETED",
      metadata: JSON.stringify({ fieldsCompleted: clientFields.length, completedAt: completedAt.toISOString() }),
    },
  });

  // Notify agent
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
  } catch { /* non-critical */ }

  return apiSuccess({ success: true }, 201);
}
