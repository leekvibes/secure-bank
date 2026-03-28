import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import { Server, CheckCircle, XCircle, AlertTriangle, Database, Zap } from "lucide-react";

function HealthRow({ label, status, detail }: { label: string; status: "ok" | "warn" | "error"; detail?: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      {status === "ok" && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
      {status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
      {status === "error" && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
      <span className="text-sm text-white/80 flex-1">{label}</span>
      {detail && <span className={`text-xs font-medium ${status === "ok" ? "text-emerald-400" : status === "warn" ? "text-amber-400" : "text-red-400"}`}>{detail}</span>}
    </div>
  );
}

export default async function AdminnnSystemPage() {
  const now = new Date();
  const [
    totalUsers, totalLinks, totalSubmissions, totalForms, totalTransfers, totalAssets,
    expiredNotCleaned, pendingVerifications, recentErrors,
  ] = await Promise.all([
    db.user.count(),
    db.secureLink.count(),
    db.submission.count(),
    db.form.count(),
    db.fileTransfer.count(),
    db.agentAsset.count(),
    db.secureLink.count({ where: { expiresAt: { lt: now }, submittedAt: null, status: { notIn: ["EXPIRED", "SUBMITTED"] } } }),
    db.user.count({ where: { emailVerified: false, role: "AGENT", createdAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { event: true, createdAt: true, agentId: true } }),
  ]);

  const stripeOk = isStripeConfigured();
  const resendOk = !!process.env.RESEND_API_KEY;
  const twilioOk = !!process.env.TWILIO_ACCOUNT_SID;
  const cronOk = !!process.env.CRON_SECRET;
  const nextauthUrl = process.env.NEXTAUTH_URL ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">System Health</h1>
        <p className="text-sm text-white/40 mt-0.5">Infrastructure, configuration, and database stats</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Integrations */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#00A3FF]" />
            <h2 className="text-sm font-bold text-white">Integrations</h2>
          </div>
          <HealthRow label="Stripe Payments" status={stripeOk ? "ok" : "error"} detail={stripeOk ? "Configured" : "MISSING KEY"} />
          <HealthRow label="Resend Email" status={resendOk ? "ok" : "warn"} detail={resendOk ? "Configured" : "Not set (emails skip)"} />
          <HealthRow label="Twilio SMS" status={twilioOk ? "ok" : "warn"} detail={twilioOk ? "Configured" : "Not set (SMS skip)"} />
          <HealthRow label="Cron Secret" status={cronOk ? "ok" : "warn"} detail={cronOk ? "Set" : "Not set (cron unprotected)"} />
          <HealthRow label="NextAuth URL" status={nextauthUrl ? "ok" : "warn"} detail={nextauthUrl ?? "Using default"} />
        </div>

        {/* Data Health */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Data Health</h2>
          </div>
          <HealthRow label="Expired links pending cleanup" status={expiredNotCleaned > 50 ? "warn" : "ok"} detail={`${expiredNotCleaned} rows`} />
          <HealthRow label="Unverified accounts (48h+)" status={pendingVerifications > 10 ? "warn" : "ok"} detail={`${pendingVerifications} users`} />
          <HealthRow label="Database connection" status="ok" detail="Connected" />
        </div>

        {/* Database Stats */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Database Counts</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Users", value: totalUsers },
              { label: "Secure Links", value: totalLinks },
              { label: "Submissions", value: totalSubmissions },
              { label: "Forms", value: totalForms },
              { label: "File Transfers", value: totalTransfers },
              { label: "Assets", value: totalAssets },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
                <p className="text-xl font-black text-white tabular-nums mt-1">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Platform Events */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Server className="w-4 h-4 text-white/50" />
            <h2 className="text-sm font-bold text-white">Recent Platform Events</h2>
          </div>
          <div className="divide-y divide-white/5 max-h-[260px] overflow-y-auto">
            {recentErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                <span className="text-xs text-white/60 flex-1">{e.event}</span>
                <span className="text-[10px] text-white/20">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {recentErrors.length === 0 && <p className="px-5 py-8 text-center text-white/30 text-sm">No recent events.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
