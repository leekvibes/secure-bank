import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { deleteFile } from "@/lib/files";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isPastRetention } from "@/lib/cleanup";

/**
 * Cleanup cron endpoint.
 *
 * Deletes submissions past their deleteAt date and marks expired links.
 * Call this via a scheduled job (Vercel Cron, GitHub Actions, external cron, etc.)
 *
 * Protect with CRON_SECRET env var — pass as Bearer token or query param.
 * e.g. GET /api/cron/cleanup?secret=<CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const provided = authHeader?.replace("Bearer ", "") ?? querySecret;

    if (provided !== cronSecret) {
      return apiError(401, "UNAUTHORIZED", "Unauthorized");
    }
  }

  const now = new Date();

  // 1) Secure submissions
  const expiredSubmissions = await db.submission.findMany({
    where: { deleteAt: { lt: now } },
    include: { link: { select: { id: true, agentId: true } } },
    take: 500,
  });

  let deletedSubmissions = 0;
  for (const sub of expiredSubmissions) {
    try {
      if (!isPastRetention(sub.deleteAt, now)) continue;
      await db.submission.delete({ where: { id: sub.id } });
      await writeAuditLog({
        event: "DELETED",
        agentId: sub.link.agentId,
        linkId: sub.link.id,
        metadata: { reason: "retention_policy_expired" },
      });
      deletedSubmissions++;
    } catch {
      // Continue even if one deletion fails
    }
  }

  // 2) Form submissions
  const expiredFormSubmissions = await db.formSubmission.findMany({
    where: { deleteAt: { lt: now } },
    include: { form: { select: { agentId: true } } },
    take: 500,
  });

  let deletedFormSubmissions = 0;
  for (const submission of expiredFormSubmissions) {
    try {
      if (!isPastRetention(submission.deleteAt, now)) continue;
      await db.formSubmission.delete({ where: { id: submission.id } });
      await writeAuditLog({
        event: "DELETED",
        agentId: submission.form.agentId,
        metadata: { reason: "retention_policy_expired", type: "form_submission" },
      });
      deletedFormSubmissions++;
    } catch {
      // continue best-effort
    }
  }

  // 3) ID uploads + encrypted files
  const expiredUploads = await db.idUpload.findMany({
    where: { deleteAt: { lt: now } },
    select: {
      id: true,
      linkId: true,
      agentId: true,
      deleteAt: true,
      frontFilePath: true,
      backFilePath: true,
    },
    take: 500,
  });

  let deletedUploads = 0;
  for (const upload of expiredUploads) {
    try {
      if (!isPastRetention(upload.deleteAt, now)) continue;
      await deleteFile(upload.frontFilePath);
      if (upload.backFilePath) await deleteFile(upload.backFilePath);
      await db.idUpload.delete({ where: { id: upload.id } });
      await writeAuditLog({
        event: "DELETED",
        agentId: upload.agentId,
        linkId: upload.linkId,
        metadata: { reason: "retention_policy_expired", type: "id_upload" },
      });
      deletedUploads++;
    } catch {
      // continue best-effort
    }
  }

  // 4) Mark expired secure links
  const { count: expiredLinks } = await db.secureLink.updateMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // 5) Mark expired form links
  const { count: expiredFormLinks } = await db.formLink.updateMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  return apiSuccess({
    success: true,
    deletedSubmissions,
    deletedFormSubmissions,
    deletedUploads,
    expiredLinks,
    expiredFormLinks,
    ranAt: now.toISOString(),
  });
}
