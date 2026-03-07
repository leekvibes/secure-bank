import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import {
  Plus, Link2, Clock, CheckCircle2, FileText, ArrowRight,
  Eye, AlertCircle, Inbox, Shield, Send, Copy,
  TrendingUp, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, isExpired, LINK_STATUS_LABELS, LINK_STATUS_COLORS, LINK_TYPES, type LinkType } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  await db.secureLink.updateMany({
    where: {
      agentId: session.user.id,
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const [
    totalLinks,
    pendingLinks,
    submittedLinks,
    expiredLinks,
    activeForms,
    totalSubmissions,
    unviewedSubmissions,
    recentLinks,
  ] = await Promise.all([
    db.secureLink.count({ where: { agentId: session.user.id } }),
    db.secureLink.count({
      where: { agentId: session.user.id, status: { in: ["CREATED", "OPENED"] } },
    }),
    db.secureLink.count({
      where: { agentId: session.user.id, status: "SUBMITTED" },
    }),
    db.secureLink.count({
      where: { agentId: session.user.id, status: "EXPIRED" },
    }),
    db.form.count({ where: { agentId: session.user.id, status: "ACTIVE" } }),
    db.submission.count({
      where: { link: { agentId: session.user.id } },
    }),
    db.submission.count({
      where: { link: { agentId: session.user.id }, revealedAt: null },
    }),
    db.secureLink.findMany({
      where: { agentId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        token: true,
        linkType: true,
        clientName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        submission: { select: { id: true, revealedAt: true } },
        idUpload: { select: { id: true, viewedAt: true } },
      },
    }),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8 animate-fade-in">

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting}, {firstName}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Dashboard Overview
          </h1>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/dashboard/new">
            <Plus className="w-4 h-4 mr-1.5" />
            New Link
          </Link>
        </Button>
      </div>

      {unviewedSubmissions > 0 && (
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-blue-200 bg-blue-50/80">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Inbox className="w-[18px] h-[18px] text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">
              {unviewedSubmissions} new submission{unviewedSubmissions !== 1 ? "s" : ""} to review
            </p>
            <p className="text-xs text-blue-700/70 mt-0.5">
              Client data has been received and is waiting for your review.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-100">
            <Link href="/dashboard/submissions">
              Review now
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}

      {expiredLinks > 0 && unviewedSubmissions === 0 && (
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-amber-200 bg-amber-50/80">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-[18px] h-[18px] text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {expiredLinks} expired link{expiredLinks !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700/70 mt-0.5">
              These links are no longer accessible. Create new ones if needed.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-100">
            <Link href="/dashboard/links">
              View all
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Links"
          value={totalLinks}
          sub="All time"
          icon={Link2}
          color="blue"
        />
        <StatCard
          label="Pending"
          value={pendingLinks}
          sub="Awaiting response"
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="Submitted"
          value={submittedLinks}
          sub="Data received"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          label="Active Forms"
          value={activeForms}
          sub="Custom forms"
          icon={FileText}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          icon={Shield}
          title="Create Secure Link"
          description="Generate an encrypted, expiring link for your client to submit sensitive information."
          href="/dashboard/new"
          actionLabel="Create link"
          color="blue"
        />
        <QuickActionCard
          icon={Inbox}
          title="View Submissions"
          description="Review and decrypt client-submitted data from your secure links."
          href="/dashboard/submissions"
          actionLabel="View submissions"
          actionCount={totalSubmissions > 0 ? totalSubmissions : undefined}
          color="emerald"
        />
        <QuickActionCard
          icon={FileText}
          title="Manage Forms"
          description="Create custom forms to collect exactly the data you need from clients."
          href="/dashboard/forms"
          actionLabel="Manage forms"
          actionCount={activeForms > 0 ? activeForms : undefined}
          color="violet"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          </div>
          <Link
            href="/dashboard/links"
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentLinks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-card border border-border/40 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Link2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No links yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Create your first secure link to start collecting client data.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/new">Create secure link</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_100px_80px] gap-4 px-5 py-3 border-b border-border/40 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client / Type</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expires</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider sr-only">Action</span>
            </div>
            {recentLinks.map((link, i) => {
              const expired = isExpired(link.expiresAt);
              const statusKey = expired && link.status !== "SUBMITTED" ? "EXPIRED" : link.status;
              const statusColor = LINK_STATUS_COLORS[statusKey] ?? "bg-muted/60 text-muted-foreground ring-border/40";
              const typeLabel = LINK_TYPES[link.linkType as LinkType] ?? link.linkType;
              const title = link.clientName ?? typeLabel;
              const isIdUpload = link.linkType === "ID_UPLOAD";
              const viewHref = isIdUpload && link.idUpload
                ? `/dashboard/uploads/${link.idUpload.id}`
                : link.submission
                ? `/dashboard/submissions/${link.submission.id}`
                : `/dashboard/links/${link.id}`;

              return (
                <Link
                  key={link.id}
                  href={viewHref}
                  className={`group block sm:grid sm:grid-cols-[1fr_120px_120px_100px_80px] gap-4 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors ${i < recentLinks.length - 1 ? "border-b border-border/30" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{title}</p>
                    {link.clientName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{typeLabel}</p>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-muted-foreground">{formatDate(link.createdAt)}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-xs ${expired ? "text-red-500" : "text-muted-foreground"}`}>
                      {formatDate(link.expiresAt)}
                    </p>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${statusColor}`}>
                      {LINK_STATUS_LABELS[statusKey] ?? statusKey}
                    </span>
                  </div>
                  <div className="hidden sm:flex justify-end">
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      View
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="sm:hidden flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{formatDate(link.createdAt)}</span>
                    <span className="text-border">|</span>
                    <span className={expired ? "text-red-500" : ""}>{expired ? "Expired" : `Exp. ${formatDate(link.expiresAt)}`}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "amber" | "emerald" | "violet";
}) {
  const styles = {
    blue: {
      bg: "bg-blue-50/80",
      border: "border-blue-100",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    amber: {
      bg: "bg-amber-50/80",
      border: "border-amber-100",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    emerald: {
      bg: "bg-emerald-50/80",
      border: "border-emerald-100",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    violet: {
      bg: "bg-violet-50/80",
      border: "border-violet-100",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
  };

  const s = styles[color];

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-5 transition-all duration-200 hover:shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${s.iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground leading-none tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-2">{sub}</p>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  actionLabel,
  actionCount,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  actionCount?: number;
  color: "blue" | "emerald" | "violet";
}) {
  const styles = {
    blue: {
      border: "border-blue-100 hover:border-blue-200",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      actionColor: "text-blue-600 hover:text-blue-700",
    },
    emerald: {
      border: "border-emerald-100 hover:border-emerald-200",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      actionColor: "text-emerald-600 hover:text-emerald-700",
    },
    violet: {
      border: "border-violet-100 hover:border-violet-200",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      actionColor: "text-violet-600 hover:text-violet-700",
    },
  };

  const s = styles[color];

  return (
    <div className={`rounded-xl border ${s.border} bg-card p-5 flex flex-col transition-all duration-200 hover:shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center mb-4`}>
        <Icon className={`w-5 h-5 ${s.iconColor}`} />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>
      <div className="mt-4 flex items-center justify-between">
        <Link
          href={href}
          className={`text-xs font-semibold ${s.actionColor} flex items-center gap-1.5 transition-colors`}
        >
          {actionLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        {actionCount !== undefined && (
          <span className="text-xs text-muted-foreground font-medium">
            {actionCount} active
          </span>
        )}
      </div>
    </div>
  );
}
