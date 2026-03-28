import { db } from "@/lib/db";
import { Link2, FileText, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const LINK_TYPE_LABELS: Record<string, string> = { BANKING_INFO: "Banking", SSN_ONLY: "SSN", FULL_INTAKE: "Full Intake", ID_UPLOAD: "ID Upload", CUSTOM_FORM: "Form Link" };
const STATUS_COLORS: Record<string, string> = { CREATED: "text-blue-400", OPENED: "text-amber-400", SUBMITTED: "text-emerald-400", EXPIRED: "text-white/30" };

export default async function AdminnnActivityPage() {
  const [recentLinks, recentSubmissions, recentSignups, recentForms] = await Promise.all([
    db.secureLink.findMany({
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, linkType: true, status: true, createdAt: true, clientName: true,
        agent: { select: { id: true, displayName: true, email: true } } },
    }),
    db.submission.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, createdAt: true,
        link: { select: { id: true, linkType: true, clientName: true, agent: { select: { id: true, displayName: true } } } } },
    }),
    db.user.findMany({
      where: { role: "AGENT" }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, email: true, displayName: true, plan: true, createdAt: true, emailVerified: true },
    }),
    db.form.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, createdAt: true, status: true,
        agent: { select: { id: true, displayName: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Activity Feed</h1>
        <p className="text-sm text-white/40 mt-0.5">Real-time platform activity across all users</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Links */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#00A3FF]" />
            <h2 className="text-sm font-bold text-white">Recent Links</h2>
            <span className="ml-auto text-xs text-white/30">{recentLinks.length}</span>
          </div>
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {recentLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[10px] bg-white/5 text-white/50 px-2 py-0.5 rounded font-medium shrink-0">{LINK_TYPE_LABELS[link.linkType] ?? link.linkType}</span>
                <div className="flex-1 min-w-0">
                  <Link href={`/adminn/users/${link.agent.id}`} className="text-xs text-white/70 hover:text-white truncate block">{link.agent.displayName}</Link>
                  {link.clientName && <p className="text-[10px] text-white/30 truncate">for {link.clientName}</p>}
                </div>
                <span className={`text-[10px] font-medium shrink-0 ${STATUS_COLORS[link.status] ?? "text-white/30"}`}>{link.status}</span>
                <span className="text-[10px] text-white/20 shrink-0">{formatDate(link.createdAt)}</span>
              </div>
            ))}
            {recentLinks.length === 0 && <p className="px-5 py-8 text-center text-white/30 text-sm">No links yet.</p>}
          </div>
        </div>

        {/* Recent Signups */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Recent Signups</h2>
            <span className="ml-auto text-xs text-white/30">{recentSignups.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {recentSignups.map((user) => (
              <Link key={user.id} href={`/adminn/users/${user.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                <div className="w-7 h-7 rounded-lg bg-[#00A3FF]/20 flex items-center justify-center text-xs font-bold text-[#00A3FF] shrink-0">
                  {user.displayName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80 truncate">{user.displayName}</p>
                  <p className="text-[10px] text-white/30 truncate">{user.email}</p>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${user.plan === "FREE" ? "bg-gray-500/20 text-gray-400" : "bg-[#00A3FF]/20 text-[#00A3FF]"}`}>{user.plan}</span>
                <span className={`text-[10px] shrink-0 ${user.emailVerified ? "text-emerald-400" : "text-amber-400"}`}>{user.emailVerified ? "✓" : "⚠"}</span>
                <span className="text-[10px] text-white/20 shrink-0">{formatDate(user.createdAt)}</span>
              </Link>
            ))}
            {recentSignups.length === 0 && <p className="px-5 py-8 text-center text-white/30 text-sm">No signups yet.</p>}
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Recent Submissions</h2>
            <span className="ml-auto text-xs text-white/30">{recentSubmissions.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {recentSubmissions.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">{sub.link?.agent.displayName ?? "Unknown"}</p>
                  {sub.link?.clientName && <p className="text-[10px] text-white/30 truncate">from {sub.link.clientName}</p>}
                </div>
                <span className="text-[10px] text-white/20 shrink-0">{formatDate(sub.createdAt)}</span>
              </div>
            ))}
            {recentSubmissions.length === 0 && <p className="px-5 py-8 text-center text-white/30 text-sm">No submissions yet.</p>}
          </div>
        </div>

        {/* Recent Forms */}
        <div className="bg-[#0D1425] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Recent Forms</h2>
            <span className="ml-auto text-xs text-white/30">{recentForms.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {recentForms.map((form) => (
              <div key={form.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80 truncate">{form.title}</p>
                  <p className="text-[10px] text-white/30 truncate">by {form.agent.displayName}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${form.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30"}`}>{form.status}</span>
                <span className="text-[10px] text-white/20 shrink-0">{formatDate(form.createdAt)}</span>
              </div>
            ))}
            {recentForms.length === 0 && <p className="px-5 py-8 text-center text-white/30 text-sm">No forms yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
