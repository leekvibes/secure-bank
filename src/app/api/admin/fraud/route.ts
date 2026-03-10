import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // High-volume accounts: users with many links in last 7 days
  const highVolumeRaw = await db.secureLink.groupBy({
    by: ["agentId"],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: { _all: true },
    having: { agentId: { _count: { gt: 5 } } },
    orderBy: { _count: { agentId: "desc" } },
    take: 20,
  });

  const highVolumeUsers = await db.user.findMany({
    where: { id: { in: highVolumeRaw.map((r) => r.agentId) } },
    select: { id: true, email: true, displayName: true, company: true, createdAt: true, bannedAt: true },
  });

  const highVolume = highVolumeRaw.map((r) => ({
    user: highVolumeUsers.find((u) => u.id === r.agentId),
    linksLast7d: r._count._all,
  })).filter((r) => r.user);

  // Failed login attempts (last 48h)
  const failedLogins = await db.auditLog.findMany({
    where: { event: "LOGIN_FAILED", createdAt: { gte: fortyEightHoursAgo } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, metadata: true, ipAddress: true, createdAt: true },
  });

  // Group failed logins by email from metadata JSON
  const failedMap: Record<string, { email: string; count: number; lastAt: Date; ip: string | null }> = {};
  for (const log of failedLogins) {
    let email = "unknown";
    try { email = JSON.parse(log.metadata ?? "{}").email ?? "unknown"; } catch {}
    if (!failedMap[email]) {
      failedMap[email] = { email, count: 0, lastAt: log.createdAt, ip: log.ipAddress };
    }
    failedMap[email].count++;
    if (log.createdAt > failedMap[email].lastAt) failedMap[email].lastAt = log.createdAt;
  }
  const failedLoginClusters = Object.values(failedMap)
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.count - a.count);

  // Recently banned
  const recentlyBanned = await db.user.findMany({
    where: { bannedAt: { not: null } },
    orderBy: { bannedAt: "desc" },
    take: 50,
    select: { id: true, email: true, displayName: true, company: true, bannedAt: true, banReason: true },
  });

  return NextResponse.json({ highVolume, failedLoginClusters, recentlyBanned });
}
