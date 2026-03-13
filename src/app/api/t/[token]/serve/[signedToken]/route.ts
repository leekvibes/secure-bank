import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTransferAccess } from "@/lib/transfer-signing";
import { writeAuditLog } from "@/lib/audit";
import { sendTransferDownloadNotification } from "@/lib/email";

// Enough time to proxy large file downloads through to the browser
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; signedToken: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`transfer:serve:${params.signedToken.slice(0, 16)}:${ip}`, {
    maxRequests: 300,
    windowMs: 15 * 60 * 1000,
  });
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

  // Atomic CAS — enforces view-once and dedupes the first-access notification
  const firstAccess = await db.fileTransfer.updateMany({
    where: { id: transfer.id, status: "ACTIVE" },
    data: { status: "DOWNLOADED" },
  });
  const isFirstAccess = firstAccess.count > 0;

  if (transfer.viewOnce && !isFirstAccess) {
    return apiError(410, "ALREADY_ACCESSED", "This transfer was view-once and has already been accessed.");
  }

  // Counters + notification
  if (payload.action === "preview") {
    await db.fileTransferFile.update({ where: { id: file.id }, data: { previewCount: { increment: 1 } } });
  } else {
    await db.fileTransferFile.update({ where: { id: file.id }, data: { downloadCount: { increment: 1 } } });
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

  await writeAuditLog({
    event: payload.action === "preview" ? "TRANSFER_FILE_PREVIEWED" : "TRANSFER_FILE_DOWNLOADED",
    agentId: transfer.agentId,
    request: req,
    metadata: { transferId: transfer.id, fileId: file.id, fileName: file.fileName, action: payload.action },
  });

  const fileBaseName = file.fileName.split("/").pop() || file.fileName;
  const safeFileName = fileBaseName.replace(/[\x00-\x1f"\\]/g, "_");

  if (payload.action === "download") {
    // Proxy the file bytes through our server with an explicit attachment header.
    // This guarantees the browser saves it to disk regardless of MIME type — no CDN
    // configuration required, no redirect for the browser to misinterpret as inline.
    const upstream = await fetch(file.blobUrl);
    if (!upstream.ok || !upstream.body) {
      return apiError(502, "UPSTREAM_ERROR", "Could not fetch file from storage.");
    }
    const headers: Record<string, string> = {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileBaseName)}`,
      "Cache-Control": "private, no-store",
    };
    const upstreamLength = upstream.headers.get("content-length");
    if (upstreamLength) headers["Content-Length"] = upstreamLength;
    return new NextResponse(upstream.body, { headers });
  }

  // Preview: redirect directly to the blob URL.
  // The client (transfer-preview-modal) follows this redirect once via fetch(),
  // reads response.url (the final CDN URL), then points <img>/<video>/<iframe>
  // at that CDN URL directly — so range requests for video go to the CDN, not here.
  return NextResponse.redirect(file.blobUrl);
}
