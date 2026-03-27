import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { readAndDecryptFile } from "@/lib/files";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });
  if (!doc) return apiError(404, "NOT_FOUND", "Document not found.");

  return apiSuccess({ doc });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });
  if (!doc) return apiError(404, "NOT_FOUND", "Document not found.");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return apiError(400, "BAD_REQUEST", "Invalid JSON."); }

  const updateData: Record<string, unknown> = {};
  if (typeof body.fieldsJson === "string") updateData.fieldsJson = body.fieldsJson;
  if (typeof body.agentSignJson === "string") updateData.agentSignJson = body.agentSignJson;
  if (typeof body.title === "string") updateData.title = body.title;
  if (typeof body.message === "string") updateData.message = body.message;
  if (typeof body.clientName === "string") updateData.clientName = body.clientName;
  if (typeof body.clientEmail === "string") updateData.clientEmail = body.clientEmail;

  const updated = await db.docSignRequest.update({
    where: { id: params.id },
    data: updateData,
  });

  return apiSuccess({ doc: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });
  if (!doc) return apiError(404, "NOT_FOUND", "Document not found.");

  await db.docSignRequest.delete({ where: { id: params.id } });
  return apiSuccess({ success: true });
}

// Serve the original document file (for the field placement editor)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
    select: { originalFilePath: true, originalName: true },
  });
  if (!doc) return apiError(404, "NOT_FOUND", "Document not found.");

  const fileBuffer = await readAndDecryptFile(doc.originalFilePath);
  const isPdf = doc.originalName?.toLowerCase().endsWith(".pdf") ?? false;

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}
