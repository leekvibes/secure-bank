import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Calendar, Link2, FileText, Shield, Star } from "lucide-react";
import { AdminnnUserActions } from "@/components/adminn-user-actions";
import { formatDate } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = { FREE: "bg-gray-500/20 text-gray-300", BEGINNER: "bg-blue-500/20 text-blue-300", PRO: "bg-[#00A3FF]/20 text-[#00A3FF]", AGENCY: "bg-purple-500/20 text-purple-300" };
const LINK_TYPE_LABELS: Record<string, string> = { BANKING_INFO: "Banking", SSN_ONLY: "SSN", FULL_INTAKE: "Full Intake", ID_UPLOAD: "ID Upload", CUSTOM_FORM: "Form" };
const STATUS_COLORS: Record<string, string> = { CREATED: "text-blue-400 bg-blue-500/10", OPENED: "text-amber-400 bg-amber-500/10", SUBMITTED: "text-emerald-400 bg-emerald-500/10", EXPIRED: "text-white/30 bg-white/5" };

function CheckCircleIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

export default async function AdminnnUserDetailPage({ params }: { params: { id: string } }) {
  const [user, recentLinks, auditLogs] = await Promise.all([
    db.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, email: true, displayName: true, agencyName: true, company: true, plan: true,
        planOverride: true, planOverrideNote: true, planOverrideBy: true, planOverriddenAt: true,
        emailVerified: true, bannedAt: true, banReason: true, createdAt: true, updatedAt: true,
        stripeSubscriptionId: true, stripeCustomerId: true, role: true, industry: true,
        onboardingCompleted: true, verificationStatus: true,
        _count: { select: { links: true, forms: true } },
      },
    }),
    db.secureLink.findMany({
      where: { agentId: params.id }, orderBy: { createdAt: "desc" }, take: 15,
      select: { id: true, linkType: true, status: true, createdAt: true, expiresAt: true, clientName: true },
    }),
    db.adminAuditLog.findMany({
      where: { targetId: params.id }, orderBy: { createdAt: "desc" }, take: 20,
    }),
  ]);

  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/adminn/users" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </Link>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#00A3FF]/20 flex items-center justify-center text-xl font-black text-[#00A3FF] shrink-0">
            {user.displayName[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white">{user.displayName}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${PLAN_COLORS[user.plan] ?? "bg-white/10 text-white"}`}>
                {user.plan}{user.planOverride ? " \u2736" : ""}
              </span>
              {user.bannedAt && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-md font-medium">Banned</span>}
              {!user.emailVerified && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-medium">Unverified</span>}
            </div>
            <p className="text-sm text-white/40 mt-1">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          {/* Info */}
          <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5">
            <h2 className="text-sm font-bold text-white mb-4">Account Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Email", value: user.email, icon: Mail },
                { label: "Joined", value: formatDate(user.createdAt), icon: Calendar },
                { label: "Links", value: user._count.links, icon: Link2 },
                { label: "Forms", value: user._count.forms, icon: FileText },
                { label: "Company", value: user.company ?? "—", icon: Shield },
                { label: "Verification", value: user.verificationStatus, icon: Star },
                { label: "Stripe Customer", value: user.stripeCustomerId ? "Connected" : "None", icon: Shield },
                { label: "Subscription", value: user.stripeSubscriptionId ? "Active" : "None", icon: Shield },
                { label: "Onboarding", value: user.onboardingCompleted ? "Done" : "Incomplete", icon: CheckCircleIcon },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">{label}</p>
                    <p className="text-white/80 mt-0.5">{String(value)}</p>
                  </div>
                </div>
              ))}
            </div>
            {user.bannedAt && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-xs text-red-300 font-medium">Banned: {formatDate(user.bannedAt)}</p>
                {user.banReason && <p className="text-xs text-red-300/70 mt-0.5">Reason: {user.banReason}</p>}
              </div>
            )}
          </div>

          {/* Recent Links */}
          <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Recent Links</h2>
              <p className="text-xs text-white/40 mt-0.5">Last {recentLinks.length} links created</p>
            </div>
            {recentLinks.length === 0 ? (
              <p className="px-5 py-8 text-center text-white/30 text-sm">No links yet.</p>
            ) : (
              recentLinks.map((link, i) => (
                <div key={link.id} className={`flex items-center gap-3 px-5 py-3 ${i < recentLinks.length - 1 ? "border-b border-white/5" : ""}`}>
                  <span className="text-xs bg-white/5 text-white/60 px-2 py-0.5 rounded font-medium shrink-0">{LINK_TYPE_LABELS[link.linkType] ?? link.linkType}</span>
                  <span className="text-xs text-white/50 flex-1 truncate">{link.clientName ?? "No client name"}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${STATUS_COLORS[link.status] ?? "text-white/30 bg-white/5"}`}>{link.status}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{formatDate(link.createdAt)}</span>
                </div>
              ))
            )}
          </div>

          {/* Admin Audit Log */}
          {auditLogs.length > 0 && (
            <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-sm font-bold text-white">Admin Action History</h2>
              </div>
              {auditLogs.map((log, i) => (
                <div key={log.id} className={`flex items-start gap-3 px-5 py-3 ${i < auditLogs.length - 1 ? "border-b border-white/5" : ""}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00A3FF]/60 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80">{log.action}</p>
                    {log.oldValue && log.newValue && (
                      <p className="text-xs text-white/40">{log.oldValue} → {log.newValue}</p>
                    )}
                    {log.note && <p className="text-xs text-white/30 mt-0.5 italic">&ldquo;{log.note}&rdquo;</p>}
                    <p className="text-[10px] text-white/20 mt-0.5">by {log.adminEmail} · {new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions panel */}
        <AdminnnUserActions
          userId={user.id}
          currentPlan={user.plan}
          planOverride={user.planOverride ?? null}
          planOverrideNote={user.planOverrideNote ?? null}
          isBanned={!!user.bannedAt}
          emailVerified={user.emailVerified}
        />
      </div>
    </div>
  );
}
