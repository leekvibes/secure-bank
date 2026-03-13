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

  if (transfer.expiresAt < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  // View-once enforcement: atomic compare-and-swap on status
  if (transfer.viewOnce) {
    const updated = await db.fileTransfer.updateMany({
      where: { id: transfer.id, status: "ACTIVE" },
      data: { status: "DOWNLOADED" },
    });
    if (updated.count === 0 && transfer.status !== "ACTIVE") {
      return NextResponse.json({ error: "Already accessed" }, { status: 410 });
    }
  }

  const file = transfer.files[0];

  // Increment download count
  await db.fileTransferFile.update({
    where: { id: file.id },
    data: { downloadCount: { increment: 1 } },
  });

  // Notify agent on first download if enabled
  if (transfer.notifyOnDownload && file.downloadCount === 0) {
    const notifyEmail = transfer.agent.notificationEmail ?? transfer.agent.email;
    sendTransferDownloadNotification({
      agentEmail: notifyEmail,
      agentName: transfer.agent.displayName,
      title: transfer.title,
      fileName: file.fileName,
    });
  }

  await writeAuditLog({
    event: "TRANSFER_FILE_DOWNLOADED",
    agentId: transfer.agentId,
    request: req,
    metadata: { transferId: transfer.id, fileId: file.id, fileName: file.fileName, action: "legacy_download" },
  });

  // getDownloadUrl adds ?download=1 which makes Vercel Blob's CDN send
  // Content-Disposition: attachment — forces save-to-device instead of playing inline.
  // This works for any file size with no proxying or timeout risk.
  const downloadUrl = getDownloadUrl(file.blobUrl);
  return NextResponse.redirect(downloadUrl);
}
