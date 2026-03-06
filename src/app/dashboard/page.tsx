import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isTwilioConfigured } from "@/lib/sms";
import Link from "next/link";
import { Plus, Link2, Clock, CheckCircle2, FileText, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkRow } from "@/components/link-row";

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

  let links: any[] = [];
  let idUploads: any[] = [];
  let formCount = 0;
  const twilioEnabled = isTwilioConfigured();

  try {
    [links, idUploads, formCount] = await Promise.all([
      db.secureLink.findMany({
        where: { agentId: session.user.id, linkType: { not: "ID_UPLOAD" } },
        include: {
          submission: { select: { id: true, revealedAt: true } },
          sends: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { method: true, recipient: true, createdAt: true },
          },
          _count: { select: { sends: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }) as Promise<any[]>,
      db.secureLink.findMany({
        where: { agentId: session.user.id, linkType: "ID_UPLOAD" },
        include: {
          idUpload: { select: { id: true, viewedAt: true } },
          sends: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { method: true, recipient: true, createdAt: true },
          },
          _count: { select: { sends: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }) as Promise<any[]>,
      db.form.count({ where: { agentId: session.user.id, status: "ACTIVE" } }),
    ]);
  } catch {
    [links, idUploads] = await Promise.all([
      db.secureLink.findMany({
        where: { agentId: session.user.id, linkType: { not: "ID_UPLOAD" } },
        include: { submission: { select: { id: true, revealedAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }) as Promise<any[]>,
      db.secureLink.findMany({
        where: { agentId: session.user.id, linkType: "ID_UPLOAD" },
        include: { idUpload: { select: { id: true, viewedAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }) as Promise<any[]>,
    ]);
    links = links.map((l) => ({ ...l, sends: [], _count: { sends: 0 } }));
    idUploads = idUploads.map((l) => ({ ...l, sends: [], _count: { sends: 0 } }));
  }

  const submitted = links.filter((l) => l.status === "SUBMITTED").length;
  const pending = links.filter((l) => l.status === "CREATED" || l.status === "OPENED").length;
  const total = links.length + idUploads.length;

  const stats = [
    {
      label: "Total Links",
      value: total,
      icon: Link2,
      gradient: "from-blue-500/10 to-blue-600/5",
      iconColor: "text-blue-500",
      borderAccent: "border-blue-500/20",
      sub: "All time",
    },
    {
      label: "Pending",
      value: pending,
      icon: Clock,
      gradient: "from-amber-500/10 to-amber-600/5",
      iconColor: "text-amber-500",
      borderAccent: "border-amber-500/20",
      sub: "Awaiting response",
    },
    {
      label: "Submitted",
      value: submitted,
      icon: CheckCircle2,
      gradient: "from-emerald-500/10 to-emerald-600/5",
      iconColor: "text-emerald-500",
      borderAccent: "border-emerald-500/20",
      sub: "Data received",
    },
    {
      label: "Active Forms",
      value: formCount,
      icon: FileText,
      gradient: "from-violet-500/10 to-violet-600/5",
      iconColor: "text-violet-500",
      borderAccent: "border-violet-500/20",
      sub: "Custom forms",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {session.user.name.split(" ")[0]}. Here&apos;s what&apos;s happening.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="w-4 h-4" />
            New link
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, gradient, iconColor, borderAccent, sub }, i) => (
          <div
            key={label}
            className={`stat-card ${borderAccent} bg-gradient-to-br ${gradient}`}
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
              <div className="w-9 h-9 rounded-lg bg-card/80 border border-border/40 flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground leading-none tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {formCount > 0 && (
        <div className="flex items-center justify-between px-5 py-4 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {formCount} active custom form{formCount !== 1 ? "s" : ""} — collect custom data securely.
            </span>
          </div>
          <Link
            href="/dashboard/forms"
            className="flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-400 font-semibold whitespace-nowrap transition-colors"
          >
            View forms
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recent Links</h2>
          </div>
          <Link
            href="/dashboard/new"
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New link
          </Link>
        </div>

        {links.length === 0 && idUploads.length === 0 ? (
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
          <div className="space-y-3">
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={{ ...link, clientPhone: link.clientPhone, submission: link.submission, idUpload: null }}
                twilioEnabled={twilioEnabled}
              />
            ))}
            {idUploads.map((link) => (
              <LinkRow
                key={link.id}
                link={{ ...link, clientPhone: link.clientPhone, submission: null, idUpload: link.idUpload }}
                twilioEnabled={twilioEnabled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
