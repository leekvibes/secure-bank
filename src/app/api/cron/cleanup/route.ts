import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // 1. Find submissions past their deleteAt
  const expiredSubmissions = await db.submission.findMany({
    where: { deleteAt: { lt: now } },
    include: { link: { select: { id: true, agentId: true } } },
    take: 100,
  });

  let deletedSubmissions = 0;
  for (const sub of expiredSubmissions) {
    try {
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

  // 2. Mark expired links
  const { count: expiredLinks } = await db.secureLink.updateMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  return NextResponse.json({
    success: true,
    deletedSubmissions,
    expiredLinks,
    ranAt: now.toISOString(),
  });
}
