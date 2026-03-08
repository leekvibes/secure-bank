"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy, CheckCheck, Send, Eye, Trash2, Loader2,
  CreditCard, Shield, ClipboardList, Camera, X, Link2, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, LINK_TYPES, isExpired, formatDate, type LinkType } from "@/lib/utils";
import { buildTrustMessage } from "@/lib/link-message";
import { getInitialSendMethod } from "@/lib/request-send";
import { toast } from "@/components/ui/use-toast";

interface LinkData {
  id: string;
  token: string;
  linkType: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  destination: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  submission: { id: string; revealedAt: Date | null } | null;
  idUpload: { id: string; viewedAt: Date | null } | null;
  sends?: { method: string; recipient: string; createdAt: Date }[];
  _count?: { sends: number };
  formId?: string;
  formTitle?: string;
  isFormLink?: boolean;
}

type DisplayStatus = "DRAFT" | "SENT" | "OPENED" | "SUBMITTED" | "EXPIRED";
type TypeTab = "ALL" | "BANKING_INFO" | "SSN_ONLY" | "FULL_INTAKE" | "ID_UPLOAD" | "CUSTOM_FORM";
type StatusFilter = "ALL" | "SENT" | "OPENED" | "SUBMITTED" | "EXPIRED";

function getDisplayStatus(link: LinkData): DisplayStatus {
  if (link.status === "SUBMITTED") return "SUBMITTED";
  if (link.status === "EXPIRED" || isExpired(link.expiresAt)) return "EXPIRED";
  if (link.status === "OPENED") return "OPENED";
  if ((link._count?.sends ?? 0) > 0) return "SENT";
  return "DRAFT";
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; dot: string; badge: string }> = {
  DRAFT:     { label: "Draft",     dot: "bg-muted-foreground/40", badge: "bg-muted/60 text-muted-foreground ring-border/40" },
  SENT:      { label: "Sent",      dot: "bg-primary",             badge: "bg-primary/10 text-primary ring-primary/20" },
  OPENED:    { label: "Opened",    dot: "bg-amber-400",           badge: "bg-amber-500/10 text-amber-500 ring-amber-500/20" },
  SUBMITTED: { label: "Submitted", dot: "bg-emerald-400",         badge: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" },
  EXPIRED:   { label: "Expired",   dot: "bg-red-400",             badge: "bg-red-500/10 text-red-500 ring-red-500/20" },
};

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string }> = {
  BANKING_INFO: { icon: CreditCard,    bg: "bg-primary/10 text-primary" },
  SSN_ONLY:     { icon: Shield,        bg: "bg-violet-500/10 text-violet-500" },
  FULL_INTAKE:  { icon: ClipboardList, bg: "bg-emerald-500/10 text-emerald-500" },
  ID_UPLOAD:    { icon: Camera,        bg: "bg-orange-500/10 text-orange-500" },
  CUSTOM_FORM:  { icon: FileText,      bg: "bg-violet-500/10 text-violet-500" },
};

const TYPE_TABS: { key: TypeTab; label: string }[] = [
  { key: "ALL",          label: "All Links" },
  { key: "BANKING_INFO", label: "Banking" },
  { key: "SSN_ONLY",     label: "Social Security" },
  { key: "FULL_INTAKE",  label: "Full Intake" },
  { key: "ID_UPLOAD",    label: "Document Upload" },
  { key: "CUSTOM_FORM",  label: "Forms" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL",       label: "All" },
  { key: "SENT",      label: "Sent" },
  { key: "OPENED",    label: "Opened" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "EXPIRED",   label: "Expired" },
];

export function RequestsTable({
  links,
}: {
  links: LinkData[];
}) {
  const [typeTab, setTypeTab] = useState<TypeTab>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const enriched = links.map((l) => ({ ...l, displayStatus: getDisplayStatus(l) }));

  const byType =
    typeTab === "ALL" ? enriched : enriched.filter((l) => l.linkType === typeTab);

  const filtered =
    statusFilter === "ALL" ? byType : byType.filter((l) => l.displayStatus === statusFilter);

  const typeCounts = TYPE_TABS.reduce((acc, { key }) => {
    acc[key] = key === "ALL" ? enriched.length : enriched.filter((l) => l.linkType === key).length;
    return acc;
  }, {} as Record<TypeTab, number>);

  const statusCounts = STATUS_FILTERS.reduce((acc, { key }) => {
    acc[key] = key === "ALL" ? byType.length : byType.filter((l) => l.displayStatus === key).length;
    return acc;
  }, {} as Record<StatusFilter, number>);

  return (
    <div className="space-y-5">
      <div className="border-b border-border/50">
        <nav className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
          {TYPE_TABS.map(({ key, label }) => {
            const isActive = typeTab === key;
            const count = typeCounts[key];
            return (
              <button
                key={key}
                onClick={() => { setTypeTab(key); setStatusFilter("ALL"); }}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2",
                  isActive
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    "ml-2 text-xs tabular-nums",
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
              statusFilter === key
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-card text-muted-foreground border border-border/60 hover:border-primary/30 hover:text-foreground"
            )}
          >
            {label}
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-semibold px-1",
                statusFilter === key ? "bg-slate-50/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {statusCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed py-14 text-center">
          <div className="w-10 h-10 bg-muted/60 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <Link2 className="w-4 h-4 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No secure links</p>
          <p className="text-sm text-muted-foreground">
            {typeTab === "ALL"
              ? "No secure links match this filter."
              : `No ${TYPE_TABS.find((t) => t.key === typeTab)?.label.toLowerCase()} links found.`}
          </p>
        </div>
      ) : (
        <div className="ui-table-wrap">
          <div className="hidden sm:grid sm:grid-cols-[2fr_1.2fr_120px_160px_auto] gap-4 px-5 py-2.5 ui-table-header border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Client</span>
            <span>Type</span>
            <span>Status</span>
            <span>Created</span>
            <span className="text-right pr-1">Actions</span>
          </div>

          <div className="divide-y divide-border/30">
            {filtered.map((link) => (
              <RequestRow key={link.id} link={link} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  link,
}: {
  link: LinkData & { displayStatus: DisplayStatus };
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isIdUpload = link.linkType === "ID_UPLOAD";
  const isFormLink = link.isFormLink === true;
  const viewHref =
    isFormLink && link.submission
      ? `/dashboard/forms/${link.formId}/submissions/${link.submission.id}`
      : isIdUpload && link.idUpload
      ? `/dashboard/uploads/${link.idUpload.id}`
      : link.submission
      ? `/dashboard/submissions/${link.submission.id}`
      : null;

  const canAct = link.displayStatus !== "SUBMITTED" && link.displayStatus !== "EXPIRED";
  const typeMeta = TYPE_META[link.linkType] ?? { icon: Shield, bg: "bg-muted/60 text-muted-foreground" };
  const TypeIcon = typeMeta.icon;
  const statusCfg = STATUS_CONFIG[link.displayStatus];

  const linkPath = isFormLink ? `/f/${link.token}` : `/secure/${link.token}`;
  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${linkPath}`
      : linkPath;

  const rowHref = isFormLink
    ? `/dashboard/forms/${link.formId}`
    : `/dashboard/links/${link.id}`;

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard
      .writeText(secureUrl)
      .then(() => {
        setCopied(true);
        toast({
          title: "Link copied",
          description: "Secure link copied to clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => {
        toast({
          title: "Clipboard failed",
          description: error instanceof Error ? error.message : "Unable to copy link in this browser.",
          variant: "destructive",
        });
      });
  }

  async function deleteLink(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/links/${link.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast({
          title: "Delete failed",
          description: payload?.error ?? "Failed to delete link.",
          variant: "destructive",
        });
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div
        className="group flex sm:grid sm:grid-cols-[2fr_1.2fr_120px_160px_auto] gap-4 px-5 py-3.5 items-center transition-all duration-200 cursor-pointer ui-table-row"
        onClick={() => router.push(rowHref)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", typeMeta.bg)}>
            <TypeIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              {link.clientName ?? (
                <span className="text-muted-foreground font-normal italic">No name</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {link.clientEmail ?? (isFormLink && link.formTitle ? link.formTitle : LINK_TYPES[link.linkType as LinkType] ?? link.linkType)}
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-sm text-muted-foreground truncate">
          {isFormLink && link.formTitle ? link.formTitle : LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
        </div>

        <div className="shrink-0">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1", statusCfg.badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusCfg.dot)} />
            {statusCfg.label}
          </span>
        </div>

        <div className="hidden sm:block text-xs text-muted-foreground tabular-nums">
          {formatDate(link.createdAt)}
        </div>

        <div
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {canAct && !isFormLink && (
            <RowAction
              icon={Send}
              label="Send"
              active={showSend}
              onClick={(e) => { e.stopPropagation(); setShowSend((o) => !o); }}
            />
          )}
          {canAct && (
            <RowAction
              icon={copied ? CheckCheck : Copy}
              label={copied ? "Copied" : "Copy link"}
              active={copied}
              onClick={copyLink}
            />
          )}
          {viewHref && (
            <RowAction
              icon={Eye}
              label="View submission"
              href={viewHref}
            />
          )}
          {deleteConfirm ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(false); }}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteLink}
                disabled={deleting}
                className="px-2 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? "..." : "Delete"}
              </button>
            </div>
          ) : (
            <RowAction
              icon={Trash2}
              label="Delete"
              danger
              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true); }}
            />
          )}
        </div>
      </div>

      {showSend && (
        <SendPanel
          link={link}
          secureUrl={secureUrl}
          onClose={() => setShowSend(false)}
          onSent={() => { setShowSend(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SendPanel({
  link,
  secureUrl,
  onClose,
  onSent,
}: {
  link: LinkData;
  secureUrl: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const defaultMsg = buildTrustMessage({
    clientName: link.clientName,
    destination: link.destination ?? "Internal processing",
    linkType: link.linkType,
    url: secureUrl,
  });

  const [method, setMethod] = useState<"EMAIL" | "COPY">(
    getInitialSendMethod({
      clientEmail: link.clientEmail,
    })
  );
  const [emailTo, setEmailTo] = useState(link.clientEmail ?? "");
  const [message, setMessage] = useState(defaultMsg);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const recipient =
      method === "EMAIL" ? emailTo.trim() : "clipboard";
    if (method === "COPY") {
      try {
        await navigator.clipboard.writeText(message);
      } catch {
        setSending(false);
        setError("Unable to copy message in this browser.");
        toast({
          title: "Clipboard failed",
          description: "Unable to copy message in this browser.",
          variant: "destructive",
        });
        return;
      }
    }

    const res = await fetch(`/api/links/${link.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, recipient, message }),
    });
    setSending(false);
    if (res.ok) {
      setSuccess(true);
      toast({
        title: method === "EMAIL" ? "Email sent" : "Link copied",
        description: method === "COPY" ? "Message copied to clipboard." : "Link sent successfully.",
      });
      setTimeout(onSent, 1200);
    } else {
      const d = await res.json();
      setError(d.error?.message ?? d.error ?? "Failed to send.");
    }
  }

  const methods = (["EMAIL", "COPY"] as const);

  return (
    <div className="border-t border-border/30 bg-gradient-to-r from-surface-2/60 via-card to-surface-2/60 backdrop-blur-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Share Secure Link</p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-xl border border-border/30 mb-3">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cn(
              "py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
              method === m
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/40"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "EMAIL" ? "Email" : "Copy Message"}
          </button>
        ))}
      </div>

      {method === "EMAIL" && (
        <Input
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
          placeholder="client@email.com"
          className="h-9 text-sm mb-2 rounded-lg"
        />
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-xl border border-border/40 bg-surface-2 px-3.5 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all"
      />

      {success ? (
        <div className="mt-3 flex items-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <p className="text-xs font-medium text-emerald-600">
            {method === "EMAIL" ? "Email sent successfully" : "Message copied to clipboard"}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={send}
            disabled={
              sending ||
              (method === "EMAIL" && !emailTo.trim()) ||
              !message.trim()
            }
            className="h-9 gap-1.5 rounded-lg flex-1"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {method === "EMAIL" ? "Send Email" : "Copy Message"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="h-9 rounded-lg">
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center gap-2 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  href,
  danger = false,
  active = false,
  disabled = false,
  spinIcon = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  spinIcon?: boolean;
}) {
  const cls = cn(
    "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200",
    disabled && "opacity-40 pointer-events-none",
    danger
      ? "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
      : active
      ? "text-emerald-600 bg-emerald-500/10"
      : "text-muted-foreground hover:text-foreground hover:bg-accent"
  );

  if (href) {
    return (
      <Link href={href} title={label} className={cls} onClick={(e) => e.stopPropagation()}>
        <Icon className="w-3.5 h-3.5" />
      </Link>
    );
  }

  return (
    <button title={label} onClick={onClick} disabled={disabled} className={cls}>
      <Icon className={cn("w-3.5 h-3.5", spinIcon && "animate-spin")} />
    </button>
  );
}
