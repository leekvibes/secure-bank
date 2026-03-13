import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { Zip, ZipPassThrough } from "fflate";
import { sendTransferDownloadNotification } from "@/lib/email";

// Allow up to 5 minutes for large video zip streams (Vercel Pro)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function slugify(name: string) {
  return name.replace(/[^\w\-. ]/g, "_").trim() || "transfer";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`transfer:zip:${params.token}:${ip}`);
  if (!rl.allowed) return apiError(429, "RATE_LIMITED", "Too many requests.");

  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    include: {
      files: {
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, blobUrl: true },
      },
      agent: { select: { id: true, email: true, displayName: true, notificationEmail: true } },
    },
  });

  if (!transfer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (transfer.expiresAt < new Date() || transfer.status === "EXPIRED") {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  if (transfer.files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const firstAccess = await db.fileTransfer.updateMany({
    where: { id: transfer.id, status: "ACTIVE" },
    data: { status: "DOWNLOADED" },
  });
  const isFirstAccess = firstAccess.count > 0;

  if (transfer.viewOnce && !isFirstAccess) {
    return NextResponse.json({ error: "Already accessed" }, { status: 410 });
  }

  if (transfer.notifyOnDownload && isFirstAccess) {
    const notifyEmail = transfer.agent.notificationEmail ?? transfer.agent.email;
    sendTransferDownloadNotification({
      agentEmail: notifyEmail,
      agentName: transfer.agent.displayName,
      title: transfer.title,
      fileName: `${transfer.files.length} files`,
    });
  }

  await writeAuditLog({
    event: "TRANSFER_FILE_DOWNLOADED",
    agentId: transfer.agentId,
    request: req,
    metadata: { transferId: transfer.id, action: "zip_all", fileCount: transfer.files.length },
  });

  const folderName = slugify(transfer.title ?? "transfer");
  const zipName = `${folderName}.zip`;

  // Stream the zip — don't await, run in background so Response can start immediately
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        const zip = new Zip((err, chunk, final) => {
          if (err) { reject(err); return; }
          writer.write(chunk);
          if (final) resolve();
        });

        (async () => {
          try {
            for (const file of transfer.files) {
              // ZipPassThrough = store mode (no re-compression) — videos are already compressed
              const entry = new ZipPassThrough(`${folderName}/${file.fileName}`);
              zip.add(entry);

              const res = await fetch(file.blobUrl);
              if (!res.ok || !res.body) {
                entry.push(new Uint8Array(0), true);
                continue;
              }

              const reader = res.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  entry.push(new Uint8Array(0), true);
                  break;
                }
                entry.push(value);
              }
            }
            zip.end();
          } catch (err) {
            reject(err);
          }
        })();
      });
    } catch {
      // best-effort close on error
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Transfer-Encoding": "chunked",
      "Cache-Control": "private, no-store",
    },
  });
}
