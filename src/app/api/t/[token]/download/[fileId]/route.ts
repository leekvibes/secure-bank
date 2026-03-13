import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { getDownloadUrl } from "@vercel/blob";
import { sendTransferDownloadNotification } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; fileId: string } }
) {
  const mode = req.nextUrl.searchParams.get("mode");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`transfer:download:${params.token}:${ip}`);
  if (!rl.allowed) return apiError(429, "RATE_LIMITED", "Too many requests.");

  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    include: {
      files: { where: { id: params.fileId } },
      agent: { select: { email: true, displayName: true, notificationEmail: true } },
    },
  });

  if (!transfer || transfer.files.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (transfer.expiresAt < new Date() || transfer.status === "EXPIRED") {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  // Atomic first-access tracking at transfer-level:
  // - prevents view-once bypasses
  // - allows one notification for a folder/multi-file transfer
  const firstAccess = await db.fileTransfer.updateMany({
    where: { id: transfer.id, status: "ACTIVE" },
    data: { status: "DOWNLOADED" },
  });
  const isFirstAccess = firstAccess.count > 0;

  if (transfer.viewOnce && !isFirstAccess) {
    return NextResponse.json({ error: "Already accessed" }, { status: 410 });
  }

  const file = transfer.files[0];

  // Increment download count
  await db.fileTransferFile.update({
    where: { id: file.id },
    data: { downloadCount: { increment: 1 } },
  });

  // Notify only once per transfer (not once per file)
  if (transfer.notifyOnDownload && isFirstAccess) {
    const notifyEmail = transfer.agent.notificationEmail ?? transfer.agent.email;
    sendTransferDownloadNotification({
      agentEmail: notifyEmail,
      agentName: transfer.agent.displayName,
      title: transfer.title,
      fileName: transfer.files.length === 1 ? file.fileName : `${transfer.files.length} files`,
    });
  }

  const mime = (file.mimeType || "").toLowerCase();
  const shouldInlineByType = mime.startsWith("image/") || mime.startsWith("video/");
  const shouldInline = mode === "preview" || shouldInlineByType;

  await writeAuditLog({
    event: mode === "preview" ? "TRANSFER_FILE_PREVIEWED" : "TRANSFER_FILE_DOWNLOADED",
    agentId: transfer.agentId,
    request: req,
    metadata: { transferId: transfer.id, fileId: file.id, fileName: file.fileName, mode: mode ?? "download" },
  });

  // Inline media helps mobile browsers route images/videos to native viewers.
  if (shouldInline) {
    return NextResponse.redirect(file.blobUrl);
  }

  // Attachment mode for documents/archives keeps normal file download behavior.
  return NextResponse.redirect(getDownloadUrl(file.blobUrl));
}
