import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { readAndDecryptFile } from "@/lib/files";
import { writeAuditLog } from "@/lib/audit";
import { NO_STORE_HEADERS } from "@/lib/http";
import { detectFileMimeType, fileExtensionFromMimeType } from "@/lib/file-signature";
import { getIdUploadAccessResult } from "@/lib/id-upload-access";

// GET /api/id-uploads/[id]?side=front|back
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const side = req.nextUrl.searchParams.get("side") ?? "front";
  const download = req.nextUrl.searchParams.get("download") === "1";

  const upload = await db.idUpload.findUnique({
    where: { id: params.id },
  });

  if (!upload) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE_HEADERS });
  }
  const access = getIdUploadAccessResult(upload.agentId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  const filePath = side === "back" ? upload.backFilePath : upload.frontFilePath;
  const originalName =
    side === "back" ? upload.backOriginalName : upload.frontOriginalName;
  const storedMimeType =
    side === "back" ? upload.backMimeType : upload.frontMimeType;
  if (!filePath) {
    return NextResponse.json({ error: "File not available." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let fileData: Buffer;
  try {
    fileData = await readAndDecryptFile(filePath);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt file." }, { status: 500, headers: NO_STORE_HEADERS });
  }

  // Track view on first access
  const isFirstView = upload.viewedAt === null;
  await db.idUpload.update({
    where: { id: upload.id },
    data: {
      viewedAt: isFirstView ? new Date() : upload.viewedAt,
      viewCount: { increment: 1 },
    },
  });

  await writeAuditLog({
    event: "ID_VIEWED",
    agentId: session.user.id,
    linkId: upload.linkId,
    request: req,
    metadata: { side, uploadId: upload.id, viewCount: upload.viewCount + 1 },
  });

  const detectedMime = detectFileMimeType(fileData);
  const mimeType = storedMimeType || detectedMime;
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
  if (!allowedMimeTypes.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type." },
      { status: 415, headers: NO_STORE_HEADERS }
    );
  }
  const ext = fileExtensionFromMimeType(mimeType);
  const disposition = download ? "attachment" : "inline";
  const sanitizedOriginal =
    originalName?.replace(/[^a-zA-Z0-9._-]/g, "_") || `id-${side}.${ext}`;
  const filename = sanitizedOriginal.includes(".")
    ? sanitizedOriginal
    : `${sanitizedOriginal}.${ext}`;

  return new NextResponse(fileData as unknown as BodyInit, {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}
