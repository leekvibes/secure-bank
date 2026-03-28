import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import { Users, Link2, FileText, TrendingUp, Activity, DollarSign, AlertTriangle, Eye } from "lucide-react";
import { SignupChart, LinkChart, PlanDonutChart } from "@/components/adminn-charts";

const PRICES: Record<string, number> = { FREE: 0, BEGINNER: 15, PRO: 29, AGENCY: 70 };
const PLAN_COLORS: Record<string, string> = { FREE: "text-gray-400", BEGINNER: "text-blue-400", PRO: "text-[#00A3FF]", AGENCY: "text-purple-400" };
const PLAN_BG: Record<string, string> = { FREE: "bg-gray-500/20", BEGINNER: "bg-blue-500/20", PRO: "bg-[#00A3FF]/20", AGENCY: "bg-purple-500/20" };

function MetricCard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; accent?: string; trend?: number;
}) {
  return (
    <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ?? "bg-[#00A3FF]/20"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-white" : "text-[#00A3FF]"}`} />
        </div>
      </div>
      <p className="text-3xl font-black text-white tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-1 font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)} today
        </p>
      )}
    </div>
  );
}

export default async function AdminnnDashboard() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [
    totalUsers, newToday, newLast7d, newLast30d,
    planCounts, totalLinks, linksToday, linksLast7d, activeLinks,
    totalSubmissions, submissionsToday, totalForms, totalTransfers,
    bannedUsers, unverifiedOld, recentOpens,
    signupsByDay, linksByDay, linksByType, recentAdminActions,
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
    db.user.count({ where: { emailVerified: false, role: "AGENT", createdAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } } }),
    db.secureLink.count({ where: { openedAt: { gte: fiveMinAgo }, submittedAt: null } }),
    db.user.findMany({ where: { createdAt: { gte: thirtyDaysAgo }, role: "AGENT" }, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    db.secureLink.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    db.secureLink.groupBy({ by: ["linkType"], _count: { _all: true } }),
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const planMap: Record<string, number> = {};
  planCounts.forEach((p) => { planMap[p.plan] = p._count._all; });
  const mrr = Object.entries(planMap).reduce((sum, [plan, count]) => sum + (PRICES[plan] ?? 0) * count, 0);

  const days30: string[] = [];
  for (let i = 29; i >= 0; i--) {
    days30.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  const signupDayMap: Record<string, number> = {};
  signupsByDay.forEach((u) => { const d = u.createdAt.toISOString().slice(0, 10); signupDayMap[d] = (signupDayMap[d] ?? 0) + 1; });
  const linkDayMap: Record<string, number> = {};
  linksByDay.forEach((l) => { const d = l.createdAt.toISOString().slice(0, 10); linkDayMap[d] = (linkDayMap[d] ?? 0) + 1; });

  const signupChart = days30.map((d) => ({ date: d, signups: signupDayMap[d] ?? 0 }));
  const linkChart = days30.map((d) => ({ date: d, links: linkDayMap[d] ?? 0 }));

  const alerts: Array<{ type: "warning" | "error" | "info"; title: string; body: string }> = [];
  if (unverifiedOld > 0) alerts.push({ type: "warning", title: `${unverifiedOld} unverified account${unverifiedOld > 1 ? "s" : ""}`, body: "These users signed up 48+ hours ago and haven't verified their email." });
  if (bannedUsers > 0) alerts.push({ type: "info", title: `${bannedUsers} banned account${bannedUsers > 1 ? "s" : ""}`, body: "Review banned accounts in Users." });
  if (!isStripeConfigured()) alerts.push({ type: "error", title: "Stripe not configured", body: "STRIPE_SECRET_KEY is missing. Payments will not work." });

  const LINK_TYPE_LABELS: Record<string, string> = { BANKING_INFO: "Banking Info", SSN_ONLY: "SSN Only", FULL_INTAKE: "Full Intake", ID_UPLOAD: "ID Upload", CUSTOM_FORM: "Custom Form" };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Mission Control</h1>
          <p className="text-sm text-white/40 mt-0.5">mysecurelink.co — real-time platform overview</p>
        </div>
        <div className="flex items-center gap-2 bg-[#0D1425] border border-white/10 rounded-xl px-4 py-2">
          <div className={`w-2 h-2 rounded-full ${recentOpens > 0 ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
          <span className="text-xs text-white/60">{recentOpens} client{recentOpens !== 1 ? "s" : ""} active now</span>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 border text-sm ${
              a.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" :
              a.type === "warning" ? "bg-amber-500/10 border-amber-500/30 text-amber-300" :
              "bg-blue-500/10 border-blue-500/30 text-blue-300"
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="opacity-80 text-xs mt-0.5">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Users" value={totalUsers} icon={Users} sub={`+${newLast7d} this week`} trend={newToday} />
        <MetricCard label="Est. MRR" value={`$${mrr.toLocaleString()}`} icon={DollarSign} sub="Based on active plans" accent="bg-emerald-500/20" />
        <MetricCard label="Total Links" value={totalLinks} icon={Link2} sub={`${activeLinks} active`} trend={linksToday} />
        <MetricCard label="Submissions" value={totalSubmissions} icon={FileText} sub={`+${submissionsToday} today`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="New (30d)" value={newLast30d} icon={TrendingUp} sub={`+${newLast7d} last 7d`} />
        <MetricCard label="Active Links" value={activeLinks} icon={Activity} />
        <MetricCard label="Forms Created" value={totalForms} icon={FileText} />
        <MetricCard label="File Transfers" value={totalTransfers} icon={Eye} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-white mb-1">New Signups — 30 Days</h2>
          <p className="text-xs text-white/40 mb-4">{newLast30d} total in this period</p>
          <SignupChart data={signupChart} />
        </div>
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Links Created — 30 Days</h2>
          <p className="text-xs text-white/40 mb-4">{linksLast7d} in last 7 days</p>
          <LinkChart data={linkChart} />
        </div>
      </div>

      {/* Plans + Link types row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Users by Plan</h2>
          <p className="text-xs text-white/40 mb-4">Distribution across tiers</p>
          <PlanDonutChart data={planMap} />
          <div className="grid grid-cols-2 gap-2 mt-4">
            {Object.entries(planMap).map(([plan, count]) => (
              <div key={plan} className={`rounded-lg px-3 py-2 ${PLAN_BG[plan] ?? "bg-white/5"}`}>
                <p className={`text-xs font-semibold ${PLAN_COLORS[plan] ?? "text-white"}`}>{plan}</p>
                <p className="text-lg font-black text-white">{count}</p>
                <p className="text-[10px] text-white/40">${(PRICES[plan] ?? 0) * count}/mo</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Links by Type</h2>
          <div className="space-y-3">
            {linksByType.map((row) => {
              const pct = totalLinks > 0 ? Math.round((row._count._all / totalLinks) * 100) : 0;
              return (
                <div key={row.linkType}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-white/70">{LINK_TYPE_LABELS[row.linkType] ?? row.linkType}</span>
                    <span className="text-xs font-semibold text-white">{row._count._all.toLocaleString()} <span className="text-white/40">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#00A3FF] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {linksByType.length === 0 && <p className="text-sm text-white/30">No links yet.</p>}
          </div>
        </div>
      </div>

      {/* Recent admin actions */}
      {recentAdminActions.length > 0 && (
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Admin Actions</h2>
          <div className="space-y-2">
            {recentAdminActions.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-2 h-2 rounded-full bg-[#00A3FF]/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white/80 font-medium">{log.action}</span>
                  {log.targetEmail && <span className="text-xs text-white/40 ml-2">on {log.targetEmail}</span>}
                  {log.note && <span className="text-xs text-white/30 ml-2">— {log.note}</span>}
                </div>
                <span className="text-[10px] text-white/30 shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
