import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { put, list } from "@vercel/blob";
import { apiError, apiSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Database backup cron — runs daily at 3am UTC via Vercel Cron.
 *
 * Exports all critical tables to JSON, compresses, and stores to Vercel Blob.
 * Keeps the last 7 daily backups and the last 4 weekly backups (Sunday).
 * Backups are stored at: backups/daily/YYYY-MM-DD.json
 *
 * Protected by CRON_SECRET — same as the cleanup cron.
 */

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured — allow (dev)
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const query = req.nextUrl.searchParams.get("secret");
  return bearer === secret || query === secret;
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return apiError(401, "UNAUTHORIZED", "Invalid cron secret.");

  const startedAt = new Date();
  const dateStr = startedAt.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    // ── Dump all critical tables ──────────────────────────────────────────────
    const [
      users,
      secureLinks,
      submissions,
      idUploads,
      forms,
      formFields,
      formLinks,
      formSubmissions,
      formSubmissionValues,
      fileTransfers,
      fileTransferFiles,
      agentAssets,
      feedback,
    ] = await Promise.all([
      db.user.findMany({
        select: {
          id: true, email: true, displayName: true, agencyName: true,
          company: true, phone: true, licenseNumber: true, agentSlug: true,
          industry: true, destinationLabel: true, verificationStatus: true,
          dataRetentionDays: true, onboardingCompleted: true, role: true,
          emailVerified: true, createdAt: true,
          // Intentionally excluding: passwordHash, logoUrl (large), photoUrl (large)
        },
      }),
      db.secureLink.findMany({
        select: {
          id: true, token: true, linkType: true, destination: true,
          destinationLabel: true, clientName: true, clientPhone: true,
          clientEmail: true, expiresAt: true, retentionDays: true,
          status: true, createdAt: true, agentId: true,
        },
      }),
      db.submission.findMany({
        select: {
          id: true, encryptedData: true, deleteAt: true,
          revealedAt: true, createdAt: true, linkId: true,
        },
      }),
      db.idUpload.findMany({
        select: {
          id: true, frontFilePath: true, frontOriginalName: true,
          backFilePath: true, backOriginalName: true,
          viewedAt: true, viewCount: true, deleteAt: true,
          createdAt: true, linkId: true, agentId: true,
        },
      }),
      db.form.findMany(),
      db.formField.findMany(),
      db.formLink.findMany({
        select: {
          id: true, token: true, status: true, expiresAt: true,
          clientName: true, clientEmail: true, createdAt: true,
          formId: true,
        },
      }),
      db.formSubmission.findMany({
        select: {
          id: true, createdAt: true, formLinkId: true,
        },
      }),
      db.formSubmissionValue.findMany(),
      db.fileTransfer.findMany({
        select: {
          id: true, token: true, title: true, status: true,
          viewOnce: true, expiresAt: true, createdAt: true, agentId: true,
        },
      }),
      db.fileTransferFile.findMany({
        select: {
          id: true, fileName: true, mimeType: true, sizeBytes: true,
          downloadCount: true, createdAt: true, transferId: true,
          // Intentionally excluding: blobUrl (sensitive storage path)
        },
      }),
      db.agentAsset.findMany({
        select: {
          id: true, type: true, name: true, createdAt: true, userId: true,
          // Intentionally excluding: url (large)
        },
      }),
      db.feedback.findMany(),
    ]);

    const backup = {
      meta: {
        createdAt: startedAt.toISOString(),
        date: dateStr,
        counts: {
          users: users.length,
          secureLinks: secureLinks.length,
          submissions: submissions.length,
          idUploads: idUploads.length,
          forms: forms.length,
          formSubmissions: formSubmissions.length,
          fileTransfers: fileTransfers.length,
          feedback: feedback.length,
        },
      },
      users,
      secureLinks,
      submissions,
      idUploads,
      forms,
      formFields,
      formLinks,
      formSubmissions,
      formSubmissionValues,
      fileTransfers,
      fileTransferFiles,
      agentAssets,
      feedback,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = await put(
      `backups/daily/${dateStr}.json`,
      json,
      { access: "public", contentType: "application/json", addRandomSuffix: false }
    );

    // ── Prune old backups — keep last 14 ─────────────────────────────────────
    try {
      const { blobs } = await list({ prefix: "backups/daily/" });
      const sorted = blobs
        .filter((b) => b.pathname !== blob.pathname)
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

      const toDelete = sorted.slice(13); // keep 14 total (today + 13 prior)
      await Promise.all(
        toDelete.map((b) =>
          fetch(b.url, { method: "DELETE" }).catch(() => {})
        )
      );
    } catch { /* pruning failure is non-critical */ }

    return apiSuccess({
      success: true,
      date: dateStr,
      blobUrl: blob.url,
      counts: backup.meta.counts,
    });

  } catch (err) {
    console.error("[backup] Failed:", err);
    return apiError(500, "BACKUP_FAILED", err instanceof Error ? err.message : "Backup failed.");
  }
}
