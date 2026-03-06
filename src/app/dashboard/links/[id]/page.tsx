import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CreditCard, Shield, ClipboardList, Camera, ImageIcon,
  Clock, Send, Eye, Building2, Calendar,
  Download,
} from "lucide-react";
import { cn, LINK_TYPES, formatDate, isExpired, type LinkType } from "@/lib/utils";
import { RequestActions } from "@/components/request-actions";
import { isTwilioConfigured } from "@/lib/sms";
import { buildRequestTimeline } from "@/lib/request-timeline";

export const metadata: Metadata = {
  title: "Request Details",
};

type DisplayStatus = "DRAFT" | "SENT" | "OPENED" | "SUBMITTED" | "EXPIRED";

function getDisplayStatus(link: {
  status: string;
  expiresAt: Date;
  sends: { id: string }[];
}): DisplayStatus {
  if (link.status === "SUBMITTED") return "SUBMITTED";
  if (link.status === "EXPIRED" || isExpired(link.expiresAt)) return "EXPIRED";
  if (link.status === "OPENED") return "OPENED";
  if (link.sends.length > 0) return "SENT";
  return "DRAFT";
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; dot: string; badge: string }> = {
  DRAFT:     { label: "Draft",     dot: "bg-slate-400",   badge: "bg-slate-500/20 text-slate-300 ring-slate-500/30" },
  SENT:      { label: "Sent",      dot: "bg-blue-500",    badge: "bg-blue-500/20 text-blue-300 ring-blue-500/30" },
  OPENED:    { label: "Opened",    dot: "bg-amber-500",   badge: "bg-amber-500/20 text-amber-300 ring-amber-500/30" },
  SUBMITTED: { label: "Submitted", dot: "bg-emerald-500", badge: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30" },
  EXPIRED:   { label: "Expired",   dot: "bg-red-400",     badge: "bg-red-500/20 text-red-300 ring-red-500/30" },
};

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string; iconColor: string; border: string;
}> = {
  BANKING_INFO: { icon: CreditCard,    bg: "bg-blue-500/10",    iconColor: "text-blue-400",   border: "border-blue-500/20" },
  SSN_ONLY:     { icon: Shield,        bg: "bg-violet-500/10",  iconColor: "text-violet-400", border: "border-violet-500/20" },
  FULL_INTAKE:  { icon: ClipboardList, bg: "bg-emerald-500/10", iconColor: "text-emerald-400",border: "border-emerald-500/20" },
  ID_UPLOAD:    { icon: Camera,        bg: "bg-orange-500/10",  iconColor: "text-orange-400", border: "border-orange-500/20" },
};

export default async function LinkDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const link = await db.secureLink.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: {
      submission: {
        select: { id: true, revealedAt: true, revealCount: true, deleteAt: true, createdAt: true },
      },
      idUpload: {
        select: { id: true, viewedAt: true, viewCount: true, deleteAt: true },
      },
      sends: { orderBy: { createdAt: "asc" } },
      assets: {
        include: { asset: { select: { id: true, url: true, mimeType: true, type: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!link) notFound();

  const auditLogs = await db.auditLog.findMany({
    where: { linkId: link.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const twilioEnabled = isTwilioConfigured();
  const displayStatus = getDisplayStatus(link);
  const statusCfg = STATUS_CONFIG[displayStatus];
  const typeMeta = TYPE_META[link.linkType] ?? TYPE_META.FULL_INTAKE;
  const TypeIcon = typeMeta.icon;
  const typeLabel = LINK_TYPES[link.linkType as LinkType] ?? link.linkType;
  const expired = isExpired(link.expiresAt);
  const timeline = buildRequestTimeline(auditLogs, link.sends);

  return (
    <div className="space-y-6 max-w-[1080px]">

      <Link
        href="/dashboard/links"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Requests
      </Link>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
              typeMeta.bg, typeMeta.border
            )}>
              <TypeIcon className={cn("w-6 h-6", typeMeta.iconColor)} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-foreground leading-tight">
                  {link.clientName ?? <span className="text-muted-foreground font-normal italic">No name</span>}
                </h1>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1",
                  statusCfg.badge
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{typeLabel}</p>
              {link.clientEmail && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">{link.clientEmail}</p>
              )}
              {link.clientPhone && (
                <p className="text-xs text-muted-foreground/70">{link.clientPhone}</p>
              )}
            </div>
          </div>

          {link.assets.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              {link.assets.slice(0, 3).map(({ asset }) => (
                <div
                  key={asset.id}
                  title={asset.name ?? asset.type}
                  className="w-10 h-10 rounded-lg border border-border bg-secondary overflow-hidden flex items-center justify-center shrink-0"
                >
                  {asset.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.name ?? "Asset"} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
              {link.assets.length > 3 && (
                <div className="w-10 h-10 rounded-lg border border-border bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
                  +{link.assets.length - 3}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-border">
          <MetaItem icon={Calendar} label={`Created ${formatDate(link.createdAt)}`} />
          <MetaItem
            icon={Clock}
            label={`${expired ? "Expired" : "Expires"} ${formatDate(link.expiresAt)}`}
            danger={expired && displayStatus !== "SUBMITTED"}
          />
          {(link.destinationLabel || link.destination) && (
            <MetaItem icon={Building2} label={link.destinationLabel ?? link.destination!} />
          )}
          <MetaItem icon={Shield} label={`${link.retentionDays}-day data retention`} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

        <div className="space-y-5">

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-6 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Activity timeline
            </h2>

            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div>
                {timeline.map((event, i) => {
                  const EventIcon = event.icon;
                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10",
                          event.iconBg
                        )}>
                          <EventIcon className={cn("w-3.5 h-3.5", event.iconColor)} />
                        </div>
                        {i < timeline.length - 1 && (
                          <div className="w-px flex-1 min-h-[20px] bg-border my-1" />
                        )}
                      </div>
                      <div className={cn("min-w-0", i < timeline.length - 1 ? "pb-5" : "pb-0")}>
                        <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                          {event.label}
                        </p>
                        {event.sublabel && (
                          <p className="text-xs text-muted-foreground mt-1">{event.sublabel}</p>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-1 tabular-nums">
                          {formatDate(event.time)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(link.submission || link.idUpload) && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                {link.idUpload ? "ID Upload" : "Submitted data"}
              </h2>

              <dl className="space-y-3 text-sm mb-5">
                {link.submission && (
                  <>
                    <Row label="Submitted" value={formatDate(link.submission.createdAt)} />
                    <Row label="Reveal count" value={String(link.submission.revealCount)} />
                    <Row
                      label="Last revealed"
                      value={link.submission.revealedAt ? formatDate(link.submission.revealedAt) : "Never"}
                    />
                    <Row label="Auto-deletes" value={formatDate(link.submission.deleteAt)} />
                  </>
                )}
                {link.idUpload && (
                  <>
                    <Row label="View count" value={String(link.idUpload.viewCount)} />
                    <Row
                      label="Last viewed"
                      value={link.idUpload.viewedAt ? formatDate(link.idUpload.viewedAt) : "Never"}
                    />
                    <Row label="Auto-deletes" value={formatDate(link.idUpload.deleteAt)} />
                  </>
                )}
              </dl>

              {link.submission && (
                <Link
                  href={`/dashboard/submissions/${link.submission.id}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Reveal encrypted data
                </Link>
              )}
              {link.idUpload && (
                <Link
                  href={`/dashboard/uploads/${link.idUpload.id}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View ID upload
                </Link>
              )}

              {link.submission && (
                <div className="flex gap-2 mt-2">
                  <a
                    href={`/api/submissions/${link.submission.id}/export?format=json`}
                    download
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export JSON
                  </a>
                  <a
                    href={`/api/submissions/${link.submission.id}/export?format=text`}
                    download
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export TXT
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-6">

          <RequestActions
            linkId={link.id}
            linkToken={link.token}
            linkType={link.linkType}
            clientName={link.clientName}
            clientPhone={link.clientPhone}
            clientEmail={link.clientEmail}
            destination={link.destinationLabel ?? link.destination}
            displayStatus={displayStatus}
            submissionId={link.submission?.id ?? null}
            idUploadId={link.idUpload?.id ?? null}
            twilioEnabled={twilioEnabled}
          />

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Request details
            </h3>
            <dl className="space-y-3">
              {([
                ["Type",        typeLabel],
                ["Status",      statusCfg.label],
                ["Client",      link.clientName ?? "—"],
                ["Phone",       link.clientPhone ?? "—"],
                ["Email",       link.clientEmail ?? "—"],
                ["Destination", link.destinationLabel ?? link.destination ?? "—"],
                ["Sends",       String(link.sends.length)],
                ["Retention",   `${link.retentionDays} days`],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground shrink-0">{label}</dt>
                  <dd className="text-foreground font-medium text-right truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Send history · {link.sends.length}
            </h3>
            {link.sends.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sends recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {[...link.sends].reverse().map((send) => (
                  <div key={send.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Send className="w-3 h-3 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {send.method === "SMS" ? "SMS" : send.method === "EMAIL" ? "Email" : "Link copied"}
                      </p>
                      {send.recipient !== "clipboard" && (
                        <p className="text-xs text-muted-foreground truncate">{send.recipient}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70 tabular-nums">
                        {formatDate(send.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm", danger ? "text-red-400" : "text-muted-foreground")}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground font-medium text-right tabular-nums">{value}</dd>
    </div>
  );
}
