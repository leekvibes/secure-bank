import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, UserX } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fraud Signals — Admin" };

export default async function AdminFraudPage() {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/dashboard");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [highVolumeRaw, failedLogins, recentlyBanned] = await Promise.all([
    db.secureLink.groupBy({
      by: ["agentId"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
      orderBy: { _count: { agentId: "desc" } },
      take: 20,
    }),
    db.auditLog.findMany({
      where: { event: "LOGIN_FAILED", createdAt: { gte: fortyEightHoursAgo } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, metadata: true, ipAddress: true, createdAt: true },
    }),
    db.user.findMany({
      where: { bannedAt: { not: null } },
      orderBy: { bannedAt: "desc" },
      take: 50,
      select: { id: true, email: true, displayName: true, company: true, bannedAt: true, banReason: true },
    }),
  ]);

  // Enrich high-volume with user info
  const hvUserIds = highVolumeRaw.map((r) => r.agentId);
  const hvUsers = await db.user.findMany({
    where: { id: { in: hvUserIds } },
    select: { id: true, email: true, displayName: true, company: true, createdAt: true, bannedAt: true },
  });
  const highVolume = highVolumeRaw
    .filter((r) => r._count._all >= 5)
    .map((r) => ({ user: hvUsers.find((u) => u.id === r.agentId)!, linksLast7d: r._count._all }))
    .filter((r) => r.user);

  // Group failed logins by email
  const failedMap: Record<string, { email: string; count: number; lastAt: Date; ip: string | null }> = {};
  for (const log of failedLogins) {
    let email = "unknown";
    try { email = JSON.parse(log.metadata ?? "{}").email ?? "unknown"; } catch {}
    if (!failedMap[email]) failedMap[email] = { email, count: 0, lastAt: log.createdAt, ip: log.ipAddress };
    failedMap[email].count++;
    if (log.createdAt > failedMap[email].lastAt) failedMap[email].lastAt = log.createdAt;
  }
  const failedClusters = Object.values(failedMap).filter((c) => c.count >= 3).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Fraud Signals</h1>
        <p className="text-sm text-muted-foreground mt-1">Suspicious activity and banned accounts</p>
      </div>

      {/* High-volume accounts */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          High-Volume Accounts (last 7 days)
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Accounts with 5+ links created in the past 7 days</p>
        {highVolume.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-volume accounts detected.</p>
        ) : (
          <div className="divide-y divide-border">
            {highVolume.map(({ user, linksLast7d }) => (
              <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}{user.company ? ` · ${user.company}` : ""}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-amber-600 tabular-nums">{linksLast7d} links</span>
                  {user.bannedAt && <span className="text-xs text-red-600 font-medium">Banned</span>}
                  <Link href={`/admin/accounts/${user.id}`} className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failed login clusters */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          Failed Login Clusters (last 48 hours)
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Emails with 3+ failed login attempts</p>
        {failedClusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suspicious login activity detected.</p>
        ) : (
          <div className="divide-y divide-border">
            {failedClusters.map((cluster) => (
              <div key={cluster.email} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground font-mono">{cluster.email}</p>
                  {cluster.ip && <p className="text-xs text-muted-foreground">IP: {cluster.ip}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-red-600 tabular-nums">{cluster.count} attempts</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(cluster.lastAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Banned accounts */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <UserX className="w-4 h-4 text-red-500" />
          Banned Accounts
        </h2>
        <p className="text-xs text-muted-foreground mb-4">{recentlyBanned.length} account{recentlyBanned.length !== 1 ? "s" : ""} banned</p>
        {recentlyBanned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No banned accounts.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentlyBanned.map((user) => (
              <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  {user.banReason && <p className="text-xs text-red-600 mt-0.5">Reason: {user.banReason}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(user.bannedAt!)}</span>
                  <Link href={`/admin/accounts/${user.id}`} className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
