import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [
    totalUsers,
    newToday,
    newLast7d,
    newLast30d,
    planCounts,
    totalLinks,
    linksToday,
    linksLast7d,
    activeLinks,
    totalSubmissions,
    submissionsToday,
    totalForms,
    totalTransfers,
    bannedUsers,
    unverifiedUsers,
    recentOpens,
    signupsByDay,
    linksByDay,
    linksByType,
    recentAdminActions,
  ] = await Promise.all([
    db.user.count({ where: { role: "AGENT" } }),
    db.user.count({ where: { createdAt: { gte: oneDayAgo }, role: "AGENT" } }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo }, role: "AGENT" } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, role: "AGENT" } }),
    db.user.groupBy({ by: ["plan"], _count: { _all: true }, where: { role: "AGENT" } }),
    db.secureLink.count(),
    db.secureLink.count({ where: { createdAt: { gte: oneDayAgo } } }),
    db.secureLink.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.secureLink.count({ where: { expiresAt: { gt: now }, submittedAt: null } }),
    db.submission.count(),
    db.submission.count({ where: { createdAt: { gte: oneDayAgo } } }),
    db.form.count(),
    db.fileTransfer.count(),
    db.user.count({ where: { bannedAt: { not: null } } }),
    db.user.count({ where: { emailVerified: false, role: "AGENT" } }),
    db.secureLink.count({ where: { openedAt: { gte: fiveMinAgo }, submittedAt: null } }),
    db.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, role: "AGENT" },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.secureLink.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.secureLink.groupBy({ by: ["linkType"], _count: { _all: true } }),
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const PRICES: Record<string, number> = { FREE: 0, BEGINNER: 15, PRO: 29, AGENCY: 70 };
  const planMap: Record<string, number> = {};
  planCounts.forEach((p) => { planMap[p.plan] = p._count._all; });
  const mrr = Object.entries(planMap).reduce((sum, [plan, count]) => sum + (PRICES[plan] ?? 0) * count, 0);

  const signupDayMap: Record<string, number> = {};
  signupsByDay.forEach((u) => {
    const day = u.createdAt.toISOString().slice(0, 10);
    signupDayMap[day] = (signupDayMap[day] ?? 0) + 1;
  });

  const linkDayMap: Record<string, number> = {};
  linksByDay.forEach((l) => {
    const day = l.createdAt.toISOString().slice(0, 10);
    linkDayMap[day] = (linkDayMap[day] ?? 0) + 1;
  });

  const days30: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days30.push(d.toISOString().slice(0, 10));
  }

  const signupChart = days30.map((d) => ({ date: d, signups: signupDayMap[d] ?? 0 }));
  const linkChart = days30.map((d) => ({ date: d, links: linkDayMap[d] ?? 0 }));

  const alerts: Array<{ type: "warning" | "error" | "info"; title: string; body: string }> = [];
  if (unverifiedUsers > 0) {
    alerts.push({ type: "warning", title: "Unverified accounts", body: `${unverifiedUsers} user${unverifiedUsers !== 1 ? "s" : ""} have not verified their email.` });
  }
  if (bannedUsers > 0) {
    alerts.push({ type: "info", title: "Banned accounts", body: `${bannedUsers} account${bannedUsers !== 1 ? "s" : ""} currently banned.` });
  }

  return NextResponse.json({
    totals: { users: totalUsers, newToday, newLast7d, newLast30d, links: totalLinks, linksToday, linksLast7d, activeLinks, submissions: totalSubmissions, submissionsToday, forms: totalForms, transfers: totalTransfers, banned: bannedUsers, unverified: unverifiedUsers, activeNow: recentOpens, mrr },
    planCounts: planMap,
    signupChart,
    linkChart,
    linksByType: linksByType.map((r) => ({ type: r.linkType, count: r._count._all })),
    recentAdminActions,
    alerts,
  });
}
