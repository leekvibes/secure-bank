import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Users, Link2, FileText, ShieldAlert, TrendingUp, Activity } from "lucide-react";

export const metadata = { title: "Mission Control — Admin" };

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-white" : "text-primary"}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

const LINK_TYPE_LABELS: Record<string, string> = {
  BANKING_INFO: "Banking Info",
  SSN_ONLY: "SSN Only",
  FULL_INTAKE: "Full Intake",
  ID_UPLOAD: "ID Upload",
};

export default async function AdminOverviewPage() {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/dashboard");

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
    db.user.count({ where: { bannedAt: { not: null } } }),
  ]);

  const submittedLinks = await db.secureLink.count({ where: { status: "SUBMITTED" } });

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Mission Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide overview</p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Accounts" value={totalUsers} icon={Users} sub={`+${newUsersLast7d} this week`} />
        <StatCard label="New (30d)" value={newUsersLast30d} icon={TrendingUp} sub={`+${newUsersLast7d} last 7 days`} />
        <StatCard label="Total Links" value={totalLinks} icon={Link2} sub={`${activeLinks} active`} />
        <StatCard label="Submissions" value={totalSubmissions} icon={FileText} sub={`${submittedLinks} links submitted`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Active Links" value={activeLinks} icon={Activity} />
        <StatCard label="Expired Links" value={expiredLinks} icon={Link2} />
        <StatCard label="Banned Accounts" value={bannedUsers} icon={ShieldAlert} accent="bg-red-600" />
      </div>

      {/* Links by type */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Links by Type</h2>
        <div className="space-y-3">
          {linksByType.map((row) => {
            const pct = totalLinks > 0 ? Math.round((row._count._all / totalLinks) * 100) : 0;
            return (
              <div key={row.linkType}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground">{LINK_TYPE_LABELS[row.linkType] ?? row.linkType}</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{row._count._all.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {linksByType.length === 0 && <p className="text-sm text-muted-foreground">No links yet.</p>}
        </div>
      </div>
    </div>
  );
}
