"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy, CheckCheck, Send, Eye, Trash2, Loader2,
  CreditCard, Shield, ClipboardList, Camera, X, Link2,
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
}

type DisplayStatus = "DRAFT" | "SENT" | "OPENED" | "SUBMITTED" | "EXPIRED";
type FilterTab = "ALL" | "SENT" | "OPENED" | "SUBMITTED" | "EXPIRED";

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
};

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: "ALL",       label: "All" },
  { key: "SENT",      label: "Sent" },
  { key: "OPENED",    label: "Opened" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "EXPIRED",   label: "Expired" },
];

export function RequestsTable({
  links,
  twilioEnabled = false,
}: {
  links: LinkData[];
  twilioEnabled?: boolean;
}) {
  const [filter, setFilter] = useState<FilterTab>("ALL");

  const enriched = links.map((l) => ({ ...l, displayStatus: getDisplayStatus(l) }));

  const filtered =
    filter === "ALL" ? enriched : enriched.filter((l) => l.displayStatus === filter);

  const counts = FILTERS.reduce((acc, { key }) => {
    acc[key] =
      key === "ALL"
        ? enriched.length
        : enriched.filter((l) => l.displayStatus === key).length;
    return acc;
  }, {} as Record<FilterTab, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
              filter === key
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-card text-muted-foreground border border-border/60 hover:border-primary/30 hover:text-foreground"
            )}
          >
            {label}
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-semibold px-1",
                filter === key ? "bg-slate-50/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed py-14 text-center">
          <div className="w-10 h-10 bg-muted/60 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <Link2 className="w-4 h-4 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No requests</p>
          <p className="text-sm text-muted-foreground">No requests match this filter.</p>
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
              <RequestRow key={link.id} link={link} twilioEnabled={twilioEnabled} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  link,
  twilioEnabled,
}: {
  link: LinkData & { displayStatus: DisplayStatus };
  twilioEnabled: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isIdUpload = link.linkType === "ID_UPLOAD";
  const viewHref =
    isIdUpload && link.idUpload
      ? `/dashboard/uploads/${link.idUpload.id}`
      : link.submission
      ? `/dashboard/submissions/${link.submission.id}`
      : null;

  const canAct = link.displayStatus !== "SUBMITTED" && link.displayStatus !== "EXPIRED";
  const typeMeta = TYPE_META[link.linkType] ?? { icon: Shield, bg: "bg-muted/60 text-muted-foreground" };
  const TypeIcon = typeMeta.icon;
  const statusCfg = STATUS_CONFIG[link.displayStatus];

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${link.token}`
      : `/secure/${link.token}`;

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
        onClick={() => router.push(`/dashboard/links/${link.id}`)}
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
              {link.clientEmail ?? LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-sm text-muted-foreground truncate">
          {LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
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
          {canAct && (
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
          twilioEnabled={twilioEnabled}
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
  twilioEnabled,
  onClose,
  onSent,
}: {
  link: LinkData;
  secureUrl: string;
  twilioEnabled: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const defaultMsg = buildTrustMessage({
    clientName: link.clientName,
    destination: link.destination ?? "Internal processing",
    linkType: link.linkType,
    url: secureUrl,
  });

  const [method, setMethod] = useState<"SMS" | "EMAIL" | "COPY">(
    getInitialSendMethod({
      twilioEnabled,
      clientPhone: link.clientPhone,
      clientEmail: link.clientEmail,
    })
  );
  const [smsTo, setSmsTo] = useState(link.clientPhone ?? "");
  const [emailTo, setEmailTo] = useState(link.clientEmail ?? "");
  const [message, setMessage] = useState(defaultMsg);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const recipient =
      method === "SMS" ? smsTo.trim() : method === "EMAIL" ? emailTo.trim() : "clipboard";
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
        title: method === "SMS" ? "SMS sent" : method === "EMAIL" ? "Email sent" : "Link copied",
        description: method === "COPY" ? "Message copied to clipboard." : "Link sent successfully.",
      });
      setTimeout(onSent, 1200);
    } else {
      const d = await res.json();
      setError(d.error?.message ?? d.error ?? "Failed to send.");
    }
  }

  const methods = (["SMS", "EMAIL", "COPY"] as const).filter(
    (m) => m !== "SMS" || twilioEnabled
  );

  return (
    <div className="border-t border-border/30 bg-surface-2/50 backdrop-blur-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Send secure link</p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-1.5 mb-3">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
              method === m
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-card border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {m === "SMS" ? "SMS" : m === "EMAIL" ? "Email" : "Copy link"}
          </button>
        ))}
      </div>

      {method === "SMS" && (
        <Input
          value={smsTo}
          onChange={(e) => setSmsTo(e.target.value)}
          placeholder="+1 555-000-0000"
          className="h-8 text-sm mb-2"
        />
      )}
      {method === "EMAIL" && (
        <Input
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
          placeholder="client@email.com"
          className="h-8 text-sm mb-2"
        />
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 resize-none transition-colors"
      />

      {success ? (
        <p className="mt-2 text-xs text-emerald-500 font-medium flex items-center gap-1.5">
          <CheckCheck className="w-3.5 h-3.5" /> Sent successfully
        </p>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={send}
            disabled={
              sending ||
              (method === "SMS" && !smsTo.trim()) ||
              (method === "EMAIL" && !emailTo.trim()) ||
              !message.trim()
            }
            className="h-8"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : method === "COPY" ? (
              "Copy"
            ) : (
              "Send now"
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="h-8">
            Cancel
          </Button>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
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
