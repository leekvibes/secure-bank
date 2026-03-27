import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readAndDecryptFile } from "@/lib/files";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const doc = await db.docSignRequest.findUnique({
    where: { token: params.token },
    select: { originalFilePath: true, originalName: true, status: true, expiresAt: true },
  });

  if (!doc) return new Response("Not found", { status: 404 });
  if (doc.status === "EXPIRED" || doc.expiresAt < new Date()) return new Response("Expired", { status: 410 });

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
