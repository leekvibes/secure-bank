import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CreditCard, Shield, ClipboardList, Camera, ImageIcon,
  Clock, Send, Eye, Building2, Calendar, Hash,
  Download, Lock, FileText, Mail, Phone, User,
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

const STATUS_CONFIG: Record<DisplayStatus, { label: string; dot: string; bg: string; text: string }> = {
  DRAFT:     { label: "Draft",     dot: "bg-slate-400",     bg: "bg-slate-500/10",    text: "text-slate-500" },
  SENT:      { label: "Sent",      dot: "bg-primary animate-pulse", bg: "bg-primary/10", text: "text-primary" },
  OPENED:    { label: "Opened",    dot: "bg-amber-500 animate-pulse", bg: "bg-amber-500/10", text: "text-amber-600" },
  SUBMITTED: { label: "Submitted", dot: "bg-emerald-500",   bg: "bg-emerald-500/10",  text: "text-emerald-600" },
  EXPIRED:   { label: "Expired",   dot: "bg-red-400",       bg: "bg-red-500/10",      text: "text-red-500" },
};

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string; gradient: string; iconBg: string; iconRing: string;
}> = {
  BANKING_INFO: { icon: CreditCard,    iconColor: "text-blue-500",    gradient: "from-blue-500/8 via-blue-500/3 to-transparent",    iconBg: "bg-blue-500/10",    iconRing: "ring-blue-500/20" },
  SSN_ONLY:     { icon: Shield,        iconColor: "text-violet-500",  gradient: "from-violet-500/8 via-violet-500/3 to-transparent",  iconBg: "bg-violet-500/10",  iconRing: "ring-violet-500/20" },
  FULL_INTAKE:  { icon: ClipboardList, iconColor: "text-emerald-500", gradient: "from-emerald-500/8 via-emerald-500/3 to-transparent", iconBg: "bg-emerald-500/10", iconRing: "ring-emerald-500/20" },
  ID_UPLOAD:    { icon: Camera,        iconColor: "text-orange-500",  gradient: "from-orange-500/8 via-orange-500/3 to-transparent",  iconBg: "bg-orange-500/10",  iconRing: "ring-orange-500/20" },
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
    <div className="max-w-[1100px] animate-fade-in">

      <Link
        href="/dashboard/links"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Back to Secure Links
      </Link>

      <div className="rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/[0.03] overflow-hidden mb-6">
        <div className={cn("bg-gradient-to-br px-8 py-7", typeMeta.gradient)}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ring-2",
              typeMeta.iconBg, typeMeta.iconRing
            )}>
              <TypeIcon className={cn("w-8 h-8", typeMeta.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {link.clientName ?? <span className="text-muted-foreground/60 font-normal">Unnamed Client</span>}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{typeLabel}</p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                  statusCfg.bg, statusCfg.text
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
                  {statusCfg.label}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/8 text-emerald-600">
                  <Lock className="w-2.5 h-2.5" />
                  End-to-End Encrypted
                </span>
              </div>
            </div>
            {link.assets.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                {link.assets.slice(0, 3).map(({ asset }) => (
                  <div
                    key={asset.id}
                    title={asset.name ?? asset.type}
                    className="w-11 h-11 rounded-xl border border-border/40 bg-card overflow-hidden flex items-center justify-center shrink-0 shadow-sm"
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
                  <div className="w-11 h-11 rounded-xl border border-border/40 bg-card flex items-center justify-center text-xs font-semibold text-muted-foreground shadow-sm">
                    +{link.assets.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40 border-t border-border/40 bg-muted/20">
          <StatCell icon={Calendar} label="Created" value={formatDate(link.createdAt)} />
          <StatCell
            icon={Clock}
            label={expired ? "Expired" : "Expires"}
            value={formatDate(link.expiresAt)}
            danger={expired && displayStatus !== "SUBMITTED"}
          />
          <StatCell icon={Building2} label="Destination" value={link.destinationLabel ?? link.destination ?? "Not set"} />
          <StatCell icon={Send} label="Sends" value={String(link.sends.length)} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

        <div className="space-y-6">

          {(link.submission || link.idUpload) && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-5 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/40">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                    {link.idUpload ? (
                      <><Camera className="w-4 h-4 text-orange-500" /> ID Upload</>
                    ) : (
                      <><FileText className="w-4 h-4 text-primary" /> Submitted Data</>
                    )}
                  </h2>
                  {link.submission && (
                    <div className="flex gap-1.5">
                      <a
                        href={`/api/submissions/${link.submission.id}/export?format=json`}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        JSON
                      </a>
                      <a
                        href={`/api/submissions/${link.submission.id}/export?format=text`}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        TXT
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {link.submission && (
                    <>
                      <MiniStat label="Submitted" value={formatDate(link.submission.createdAt)} />
                      <MiniStat label="Reveal Count" value={String(link.submission.revealCount)} />
                      <MiniStat
                        label="Last Revealed"
                        value={link.submission.revealedAt ? formatDate(link.submission.revealedAt) : "Never"}
                      />
                    </>
                  )}
                  {link.idUpload && (
                    <>
                      <MiniStat label="View Count" value={String(link.idUpload.viewCount)} />
                      <MiniStat
                        label="Last Viewed"
                        value={link.idUpload.viewedAt ? formatDate(link.idUpload.viewedAt) : "Never"}
                      />
                    </>
                  )}
                </div>

                {link.submission && (
                  <Link
                    href={`/dashboard/submissions/${link.submission.id}`}
                    className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal Encrypted Data
                  </Link>
                )}
                {link.idUpload && (
                  <Link
                    href={`/dashboard/uploads/${link.idUpload.id}`}
                    className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
                  >
                    <Eye className="w-4 h-4" />
                    View ID Upload
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-muted/30 to-transparent border-b border-border/40">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Activity Timeline
                <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  {timeline.length} event{timeline.length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>
            <div className="p-6">
              {timeline.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, i) => {
                    const EventIcon = event.icon;
                    return (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 ring-1 ring-offset-2 ring-offset-card",
                            event.iconBg,
                            event.iconBg.replace("bg-", "ring-").replace("/100", "/30").replace("/10", "/20")
                          )}>
                            <EventIcon className={cn("w-4 h-4", event.iconColor)} />
                          </div>
                          {i < timeline.length - 1 && (
                            <div className="w-px flex-1 min-h-[24px] bg-gradient-to-b from-border to-border/20 my-1.5" />
                          )}
                        </div>
                        <div className={cn("min-w-0 flex-1", i < timeline.length - 1 ? "pb-6" : "pb-0")}>
                          <p className="text-sm font-medium text-foreground mt-2 leading-none">
                            {event.label}
                          </p>
                          {event.sublabel && (
                            <p className="text-xs text-muted-foreground mt-1">{event.sublabel}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60 mt-1 tabular-nums">
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

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-muted/30 to-transparent border-b border-border/40">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Client Details
              </h3>
            </div>
            <div className="p-5 space-y-3.5">
              <DetailRow icon={User} label="Name" value={link.clientName ?? "Not provided"} />
              <DetailRow icon={Mail} label="Email" value={link.clientEmail ?? "Not provided"} />
              <DetailRow icon={Phone} label="Phone" value={link.clientPhone ?? "Not provided"} />
              <DetailRow icon={Building2} label="Destination" value={link.destinationLabel ?? link.destination ?? "Not set"} />
              <DetailRow icon={Hash} label="Link Type" value={typeLabel} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-500/5 to-transparent border-b border-border/40">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                Send History
                {link.sends.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {link.sends.length}
                  </span>
                )}
              </h3>
            </div>
            <div className="p-5">
              {link.sends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sends recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {[...link.sends].reverse().map((send) => (
                    <div key={send.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        {send.method === "EMAIL" ? (
                          <Mail className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Send className="w-3.5 h-3.5 text-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {send.method === "EMAIL" ? "Email" : send.method === "SMS" ? "SMS" : "Link copied"}
                        </p>
                        {send.recipient !== "clipboard" && (
                          <p className="text-xs text-muted-foreground truncate">{send.recipient}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 tabular-nums mt-0.5">
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

function StatCell({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("w-3 h-3", danger ? "text-red-500" : "text-muted-foreground/60")} />
        <span className={cn("text-[11px] font-medium uppercase tracking-wider", danger ? "text-red-500" : "text-muted-foreground/60")}>{label}</span>
      </div>
      <p className={cn("text-sm font-semibold truncate", danger ? "text-red-500" : "text-foreground")}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/25 border border-border/30 px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <span className="text-sm font-medium text-foreground text-right truncate">{value}</span>
      </div>
    </div>
  );
}
