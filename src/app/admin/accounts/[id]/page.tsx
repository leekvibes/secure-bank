import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, Building2, Phone, FileText, Shield, Clock, Link2, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { AccountDetailActions } from "./account-detail-actions";
import { VerificationEditor } from "./verification-editor";

export const metadata = { title: "Account Detail — Admin" };

const VERIFICATION_COLORS: Record<string, string> = {
  UNVERIFIED: "text-gray-500 bg-gray-100",
  LICENSED: "text-blue-600 bg-blue-50",
  CERTIFIED: "text-emerald-600 bg-emerald-50",
  REGULATED: "text-purple-600 bg-purple-50",
};

const STATUS_COLORS: Record<string, string> = {
  CREATED: "text-gray-500 bg-gray-100",
  OPENED: "text-amber-600 bg-amber-50",
  SUBMITTED: "text-emerald-600 bg-emerald-50",
  EXPIRED: "text-red-500 bg-red-50",
};

export default async function AdminAccountDetailPage({ params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/dashboard");

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      company: true,
      agencyName: true,
      industry: true,
      phone: true,
      licenseNumber: true,
      verificationStatus: true,
      role: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      _count: { select: { links: true, idUploads: true } },
    },
  });

  if (!user) notFound();

  const [recentLinks, auditLogs, submissionCount, lastActive] = await Promise.all([
    db.secureLink.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, linkType: true, status: true, createdAt: true, submittedAt: true, clientName: true },
    }),
    db.auditLog.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, event: true, ipAddress: true, createdAt: true },
    }),
    db.submission.count({ where: { link: { agentId: params.id } } }),
    db.auditLog.findFirst({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const initials = user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const companyName = user.company ?? user.agencyName;
  const isBanned = !!user.bannedAt;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link href="/admin/accounts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Accounts
      </Link>

      {/* Ban banner */}
      {isBanned && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-700">Account Banned</p>
            <p className="text-xs text-red-600 mt-0.5">{user.banReason}</p>
            <p className="text-xs text-red-500 mt-0.5">Banned {formatDate(user.bannedAt!)}</p>
          </div>
          <AccountDetailActions userId={user.id} isBanned={true} isAdmin={user.role === "ADMIN"} />
        </div>
      )}

      {/* Profile header */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0 ring-2 ring-primary/10">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{user.displayName}</h1>
                {user.role === "ADMIN" && (
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Admin</span>
                )}
                <VerificationEditor userId={user.id} currentStatus={user.verificationStatus} />
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {companyName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {companyName}
                </p>
              )}
            </div>
          </div>

          {!isBanned && (
            <AccountDetailActions userId={user.id} isBanned={false} isAdmin={user.role === "ADMIN"} />
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-border text-sm text-muted-foreground">
          <span>Joined {formatDate(user.createdAt)}</span>
          {lastActive && <span>Last active {formatDate(lastActive.createdAt)}</span>}
          {user.phone && (
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{user.phone}</span>
          )}
          {user.licenseNumber && (
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Lic. #{user.licenseNumber}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Links Created", value: user._count.links, icon: Link2 },
          { label: "Submissions", value: submissionCount, icon: Inbox },
          { label: "ID Uploads", value: user._count.idUploads, icon: Shield },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card rounded-xl border border-border shadow-sm p-4 text-center">
            <Icon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent links */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent Links</h2>
        {recentLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <div className="space-y-0 divide-y divide-border">
            {recentLinks.map((link) => (
              <div key={link.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{link.linkType.replace(/_/g, " ")}</p>
                  {link.clientName && <p className="text-xs text-muted-foreground">{link.clientName}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[link.status] ?? "text-gray-500 bg-gray-100"}`}>
                    {link.status}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(link.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Activity Log (last 50 events)
        </h2>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity.</p>
        ) : (
          <div className="space-y-0 divide-y divide-border">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-sm font-mono text-foreground">{log.event}</span>
                <div className="flex items-center gap-3 shrink-0">
                  {log.ipAddress && <span className="text-xs text-muted-foreground font-mono">{log.ipAddress}</span>}
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
