import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

/**
 * Cleanup cron endpoint.
 *
 * Marks stale links as EXPIRED.
 * Submissions and uploads are NEVER auto-deleted — agents delete manually.
 *
 * Call via a scheduled job (Vercel Cron, GitHub Actions, etc.)
 * Protect with CRON_SECRET env var.
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

  // 1) Mark expired secure links
  const { count: expiredLinks } = await db.secureLink.updateMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // 2) Mark expired form links
  const { count: expiredFormLinks } = await db.formLink.updateMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  return apiSuccess({
    success: true,
    expiredLinks,
    expiredFormLinks,
    ranAt: now.toISOString(),
  });
}
