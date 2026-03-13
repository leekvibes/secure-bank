import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTransferAccess } from "@/lib/transfer-signing";
import { writeAuditLog } from "@/lib/audit";
import { getDownloadUrl } from "@vercel/blob";
import { sendTransferDownloadNotification } from "@/lib/email";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; signedToken: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`transfer:serve:${params.signedToken.slice(0, 16)}:${ip}`);
  if (!rl.allowed) return apiError(429, "RATE_LIMITED", "Too many requests.");

  const payload = verifyTransferAccess(params.signedToken);
  if (!payload) return apiError(401, "INVALID_TOKEN", "Invalid or expired access token.");
  if (payload.transferToken !== params.token) return apiError(401, "TOKEN_MISMATCH", "Token mismatch.");

  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    include: {
      files: { where: { id: payload.fileId } },
      agent: { select: { email: true, displayName: true, notificationEmail: true } },
      _count: { select: { files: true } },
    },
  });

  if (!transfer || transfer.files.length === 0) return apiError(404, "NOT_FOUND", "File not found.");
  if (transfer.expiresAt < new Date() || transfer.status === "EXPIRED") {
    return apiError(410, "EXPIRED", "This transfer has expired.");
  }

  const file = transfer.files[0];

  // Transfer-level first access for both view-once enforcement and notification dedupe.
  const firstAccess = await db.fileTransfer.updateMany({
    where: { id: transfer.id, status: "ACTIVE" },
    data: { status: "DOWNLOADED" },
  });
  const isFirstAccess = firstAccess.count > 0;

  if (transfer.viewOnce && !isFirstAccess) {
    return apiError(410, "ALREADY_ACCESSED", "This transfer was view-once and has already been accessed.");
  }

  // Update counters
  if (payload.action === "preview") {
    await db.fileTransferFile.update({ where: { id: file.id }, data: { previewCount: { increment: 1 } } });
  } else {
    await db.fileTransferFile.update({ where: { id: file.id }, data: { downloadCount: { increment: 1 } } });
    // Notify agent once per transfer, not once per file.
    if (transfer.notifyOnDownload && isFirstAccess) {
      const notifyEmail = transfer.agent.notificationEmail ?? transfer.agent.email;
      sendTransferDownloadNotification({
        agentEmail: notifyEmail,
        agentName: transfer.agent.displayName,
        title: transfer.title,
        fileName: transfer._count.files === 1 ? file.fileName : `${transfer._count.files} files`,
      });
    }
  }

  // Audit
  await writeAuditLog({
    event: payload.action === "preview" ? "TRANSFER_FILE_PREVIEWED" : "TRANSFER_FILE_DOWNLOADED",
    agentId: transfer.agentId,
    request: req,
    metadata: { transferId: transfer.id, fileId: file.id, fileName: file.fileName, action: payload.action },
  });

  // Download: force attachment via getDownloadUrl (?download=1 tells Vercel Blob CDN
  // to send Content-Disposition: attachment — works for any MIME type including video).
  // Preview: redirect directly to the blob URL so the CDN serves it with the correct
  // Content-Type and full Range-request support (required for video seeking).
  const cdnUrl = payload.action === "download"
    ? getDownloadUrl(file.blobUrl)
    : file.blobUrl;

  return NextResponse.redirect(cdnUrl);
}
