import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { readAndDecryptFile } from "@/lib/files";
import { apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
    select: { signedFilePath: true, originalName: true, status: true, title: true },
  });

  if (!doc) return apiError(404, "NOT_FOUND", "Document not found.");
  if (doc.status !== "COMPLETED" || !doc.signedFilePath) return apiError(400, "NOT_SIGNED", "Document has not been signed yet.");

  const fileBuffer = await readAndDecryptFile(doc.signedFilePath);
  const isPdf = doc.originalName?.toLowerCase().endsWith(".pdf") ?? true;
  const downloadName = doc.title ? `${doc.title.replace(/[^a-z0-9\s]/gi, "").trim()}-signed.pdf` : "signed-document.pdf";

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "image/jpeg",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}
