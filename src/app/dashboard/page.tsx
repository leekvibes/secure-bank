import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isTwilioConfigured } from "@/lib/sms";
import Link from "next/link";
import { Plus, Link2, Clock, CheckCircle2, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkRow } from "@/components/link-row";

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
    { label: "Total links", value: total, icon: Link2, iconBg: "bg-blue-50", iconColor: "text-blue-600", sub: "All time" },
    { label: "Pending", value: pending, icon: Clock, iconBg: "bg-amber-50", iconColor: "text-amber-600", sub: "Awaiting response" },
    { label: "Submitted", value: submitted, icon: CheckCircle2, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", sub: "Data received" },
    { label: "Active forms", value: formCount, icon: FileText, iconBg: "bg-violet-50", iconColor: "text-violet-600", sub: "Custom forms" },
  ];

  return (
    <div className="space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
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

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
              <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
            <p className="text-xs text-slate-400 mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Forms callout ── */}
      {formCount > 0 && (
        <div className="flex items-center justify-between px-5 py-3.5 bg-violet-50 border border-violet-100 rounded-xl">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-violet-600 shrink-0" />
            <span className="text-sm font-medium text-violet-800">
              {formCount} active custom form{formCount !== 1 ? "s" : ""} — collect custom data securely.
            </span>
          </div>
          <Link href="/dashboard/forms" className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold whitespace-nowrap">
            View forms
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Links list ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent links</h2>
          <Link href="/dashboard/new" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            New link
          </Link>
        </div>

        {links.length === 0 && idUploads.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-14 text-center">
            <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
              <Link2 className="w-5 h-5 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">No links yet</p>
            <p className="text-sm text-slate-400 mb-5">Create your first secure link to start collecting client data.</p>
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
