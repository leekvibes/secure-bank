import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast7d,
    newUsersLast30d,
    totalLinks,
    activeLinks,
    expiredLinks,
    totalSubmissions,
    linksByType,
    recentSignups,
    bannedUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.secureLink.count(),
    db.secureLink.count({ where: { status: { in: ["CREATED", "OPENED"] } } }),
    db.secureLink.count({ where: { status: "EXPIRED" } }),
    db.submission.count(),
    db.secureLink.groupBy({ by: ["linkType"], _count: { _all: true } }),
    db.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.count({ where: { bannedAt: { not: null } } }),
  ]);

  // Build 30-day sparkline grouped by date string
  const sparklineMap: Record<string, number> = {};
  for (const u of recentSignups) {
    const key = u.createdAt.toISOString().slice(0, 10);
    sparklineMap[key] = (sparklineMap[key] ?? 0) + 1;
  }
  const sparkline = Object.entries(sparklineMap).map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    totalUsers,
    newUsersLast7d,
    newUsersLast30d,
    totalLinks,
    activeLinks,
    expiredLinks,
    totalSubmissions,
    bannedUsers,
    linksByType: linksByType.map((r) => ({ type: r.linkType, count: r._count._all })),
    sparkline,
  });
}
