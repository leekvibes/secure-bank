import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CreditCard, Shield, ClipboardList, Camera, ImageIcon,
  Clock, Send, Eye, Building2, Calendar,
  Download, Lock, Info, History, FileText, Zap,
} from "lucide-react";
import { cn, LINK_TYPES, formatDate, isExpired, type LinkType } from "@/lib/utils";
import { RequestActions } from "@/components/request-actions";
import { buildRequestTimeline } from "@/lib/request-timeline";

export const metadata: Metadata = {
  title: "Link Details",
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
  DRAFT:     { label: "Draft",     dot: "bg-muted-foreground/50", badge: "bg-muted/60 text-muted-foreground ring-border/50" },
  SENT:      { label: "Sent",      dot: "bg-primary animate-pulse",             badge: "bg-primary/10 text-primary ring-primary/25" },
  OPENED:    { label: "Opened",    dot: "bg-amber-500 animate-pulse",           badge: "bg-amber-500/10 text-amber-600 ring-amber-500/25" },
  SUBMITTED: { label: "Submitted", dot: "bg-emerald-500",         badge: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25" },
  EXPIRED:   { label: "Expired",   dot: "bg-red-400",             badge: "bg-red-500/10 text-red-500 ring-red-500/25" },
};

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string; iconColor: string; border: string; gradient: string;
}> = {
  BANKING_INFO: { icon: CreditCard,    bg: "bg-blue-500/10",    iconColor: "text-blue-500",    border: "border-blue-500/20",    gradient: "from-blue-500/5 via-primary/5 to-transparent" },
  SSN_ONLY:     { icon: Shield,        bg: "bg-violet-500/10",  iconColor: "text-violet-500",  border: "border-violet-500/20",  gradient: "from-violet-500/5 via-primary/5 to-transparent" },
  FULL_INTAKE:  { icon: ClipboardList, bg: "bg-emerald-500/10", iconColor: "text-emerald-500", border: "border-emerald-500/20", gradient: "from-emerald-500/5 via-primary/5 to-transparent" },
  ID_UPLOAD:    { icon: Camera,        bg: "bg-orange-500/10",  iconColor: "text-orange-500",  border: "border-orange-500/20",  gradient: "from-orange-500/5 via-primary/5 to-transparent" },
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
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Requests
      </Link>

      <div className={cn(
        "bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden"
      )}>
        <div className={cn("bg-gradient-to-r p-6", typeMeta.gradient)}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

            <div className="flex items-start gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border ring-2 ring-offset-2 ring-offset-card",
                typeMeta.bg, typeMeta.border,
                typeMeta.border.replace("border-", "ring-")
              )}>
                <TypeIcon className={cn("w-7 h-7", typeMeta.iconColor)} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {link.clientName ?? <span className="text-muted-foreground font-normal italic">No name</span>}
                  </h1>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 shadow-sm",
                    statusCfg.badge
                  )}>
                    <span className={cn("w-2 h-2 rounded-full", statusCfg.dot)} />
                    {statusCfg.label}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                    <Lock className="w-3 h-3" />
                    Encrypted
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 font-medium">{typeLabel}</p>
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
                    className="w-10 h-10 rounded-xl border border-border/60 bg-secondary/80 overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-border/20"
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
                  <div className="w-10 h-10 rounded-xl border border-border/60 bg-secondary/80 flex items-center justify-center text-xs font-semibold text-muted-foreground ring-1 ring-border/20">
                    +{link.assets.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
          <MetaPill icon={Calendar} label={`Created ${formatDate(link.createdAt)}`} />
          <MetaPill
            icon={Clock}
            label={`${expired ? "Expired" : "Expires"} ${formatDate(link.expiresAt)}`}
            danger={expired && displayStatus !== "SUBMITTED"}
          />
          {(link.destinationLabel || link.destination) && (
            <MetaPill icon={Building2} label={link.destinationLabel ?? link.destination!} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

        <div className="space-y-5">

          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent border-b border-border/40">
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Activity Timeline
              </h2>
            </div>

            <div className="p-6">
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
                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ring-2 ring-offset-2 ring-offset-card",
                            event.iconBg,
                            event.iconBg.replace("bg-", "ring-").replace("/100", "/30").replace("/10", "/20")
                          )}>
                            <EventIcon className={cn("w-4 h-4", event.iconColor)} />
                          </div>
                          {i < timeline.length - 1 && (
                            <div className="w-px flex-1 min-h-[24px] bg-gradient-to-b from-border via-border/60 to-border/30 my-1" />
                          )}
                        </div>
                        <div className={cn("min-w-0", i < timeline.length - 1 ? "pb-6" : "pb-0")}>
                          <p className="text-sm font-semibold text-foreground mt-2 leading-none">
                            {event.label}
                          </p>
                          {event.sublabel && (
                            <p className="text-xs text-muted-foreground mt-1.5">{event.sublabel}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60 mt-1 tabular-nums font-medium">
                            {formatDate(event.time)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {(link.submission || link.idUpload) && (
            <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border/40">
                <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  {link.idUpload ? (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      ID Upload
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      Submitted Data
                    </>
                  )}
                </h2>
              </div>

              <div className="p-6">
                <dl className="space-y-3 text-sm mb-5">
                  {link.submission && (
                    <>
                      <Row label="Submitted" value={formatDate(link.submission.createdAt)} />
                      <Row label="Reveal count" value={String(link.submission.revealCount)} />
                      <Row
                        label="Last revealed"
                        value={link.submission.revealedAt ? formatDate(link.submission.revealedAt) : "Never"}
                      />
                    </>
                  )}
                  {link.idUpload && (
                    <>
                      <Row label="View count" value={String(link.idUpload.viewCount)} />
                      <Row
                        label="Last viewed"
                        value={link.idUpload.viewedAt ? formatDate(link.idUpload.viewedAt) : "Never"}
                      />
                    </>
                  )}
                </dl>

                {link.submission && (
                  <Link
                    href={`/dashboard/submissions/${link.submission.id}`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal encrypted data
                  </Link>
                )}
                {link.idUpload && (
                  <Link
                    href={`/dashboard/uploads/${link.idUpload.id}`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
                  >
                    <Eye className="w-4 h-4" />
                    View ID upload
                  </Link>
                )}

                {link.submission && (
                  <div className="flex gap-2 mt-3">
                    <a
                      href={`/api/submissions/${link.submission.id}/export?format=json`}
                      download
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/60 text-muted-foreground text-xs font-semibold hover:bg-secondary/80 transition-all ring-1 ring-transparent hover:ring-border/40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export JSON
                    </a>
                    <a
                      href={`/api/submissions/${link.submission.id}/export?format=text`}
                      download
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/60 text-muted-foreground text-xs font-semibold hover:bg-secondary/80 transition-all ring-1 ring-transparent hover:ring-border/40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export TXT
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-6">

          <RequestActions
            linkId={link.id}
            linkToken={link.token}
            linkType={link.linkType}
            clientName={link.clientName}
            clientEmail={link.clientEmail}
            destination={link.destinationLabel ?? link.destination}
            displayStatus={displayStatus}
            submissionId={link.submission?.id ?? null}
            idUploadId={link.idUpload?.id ?? null}
          />

          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent border-b border-border/40">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Request Details
              </h3>
            </div>
            <div className="p-5">
              <dl className="space-y-3">
                {([
                  ["Type",        typeLabel],
                  ["Status",      statusCfg.label],
                  ["Client",      link.clientName ?? "—"],
                  ["Phone",       link.clientPhone ?? "—"],
                  ["Email",       link.clientEmail ?? "—"],
                  ["Destination", link.destinationLabel ?? link.destination ?? "—"],
                  ["Sends",       String(link.sends.length)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground/80 shrink-0 text-xs font-medium uppercase tracking-wide">{label}</dt>
                    <dd className="text-foreground font-semibold text-right truncate text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 bg-gradient-to-r from-blue-500/5 via-muted/20 to-transparent border-b border-border/40">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <History className="w-3.5 h-3.5" />
                Send History
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-1 ring-border/40">
                  {link.sends.length}
                </span>
              </h3>
            </div>
            <div className="p-5">
              {link.sends.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sends recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {[...link.sends].reverse().map((send) => (
                    <div key={send.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-blue-500/20 ring-offset-1 ring-offset-card">
                        <Send className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {send.method === "EMAIL" ? "Email" : send.method === "SMS" ? "SMS" : "Link copied"}
                        </p>
                        {send.recipient !== "clipboard" && (
                          <p className="text-xs text-muted-foreground truncate">{send.recipient}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 tabular-nums font-medium">
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
    </div>
  );
}

function MetaPill({
  icon: Icon,
  label,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ring-1",
      danger
        ? "text-red-500 bg-red-500/5 ring-red-500/20"
        : "text-muted-foreground bg-muted/40 ring-border/40"
    )}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground/80 shrink-0 text-xs font-medium uppercase tracking-wide">{label}</dt>
      <dd className="text-foreground font-semibold text-right tabular-nums text-sm">{value}</dd>
    </div>
  );
}
