import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { readAndDecryptFile } from "@/lib/files";
import { writeAuditLog } from "@/lib/audit";
import { NO_STORE_HEADERS } from "@/lib/http";

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

  const upload = await db.idUpload.findFirst({
    where: { id: params.id, agentId: session.user.id }, // agent isolation
  });

  if (!upload) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const filePath = side === "back" ? upload.backFilePath : upload.frontFilePath;
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

  return new NextResponse(fileData as unknown as BodyInit, {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "image/jpeg", // browsers handle detection from content
      "Content-Disposition": `inline; filename="id-${side}.jpg"`,
    },
  });
}
