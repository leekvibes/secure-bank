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

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Status / type configs ────────────────────────────────────────────────────

function getDisplayStatus(link: LinkData): DisplayStatus {
  if (link.status === "SUBMITTED") return "SUBMITTED";
  if (link.status === "EXPIRED" || isExpired(link.expiresAt)) return "EXPIRED";
  if (link.status === "OPENED") return "OPENED";
  if ((link._count?.sends ?? 0) > 0) return "SENT";
  return "DRAFT";
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; dot: string; badge: string }> = {
  DRAFT:     { label: "Draft",     dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 ring-slate-200/70" },
  SENT:      { label: "Sent",      dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 ring-blue-200/70" },
  OPENED:    { label: "Opened",    dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 ring-amber-200/70" },
  SUBMITTED: { label: "Submitted", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/70" },
  EXPIRED:   { label: "Expired",   dot: "bg-red-400",     badge: "bg-red-50 text-red-600 ring-red-200/70" },
};

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string }> = {
  BANKING_INFO: { icon: CreditCard,    bg: "bg-blue-50 text-blue-600" },
  SSN_ONLY:     { icon: Shield,        bg: "bg-violet-50 text-violet-600" },
  FULL_INTAKE:  { icon: ClipboardList, bg: "bg-emerald-50 text-emerald-600" },
  ID_UPLOAD:    { icon: Camera,        bg: "bg-orange-50 text-orange-600" },
};

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: "ALL",       label: "All" },
  { key: "SENT",      label: "Sent" },
  { key: "OPENED",    label: "Opened" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "EXPIRED",   label: "Expired" },
];

// ── Main component ───────────────────────────────────────────────────────────

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
      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === key
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {label}
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-semibold px-1",
                filter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Link2 className="w-4 h-4 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">No requests</p>
          <p className="text-sm text-slate-400">No requests match this filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shadow-slate-200/40">
          {/* Column headers — desktop */}
          <div className="hidden sm:grid sm:grid-cols-[2fr_1.2fr_120px_160px_auto] gap-4 px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <span>Client</span>
            <span>Type</span>
            <span>Status</span>
            <span>Created</span>
            <span className="text-right pr-1">Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((link) => (
              <RequestRow key={link.id} link={link} twilioEnabled={twilioEnabled} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Request Row ──────────────────────────────────────────────────────────────

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

  const isIdUpload = link.linkType === "ID_UPLOAD";
  const viewHref =
    isIdUpload && link.idUpload
      ? `/dashboard/uploads/${link.idUpload.id}`
      : link.submission
      ? `/dashboard/submissions/${link.submission.id}`
      : null;

  const canAct = link.displayStatus !== "SUBMITTED" && link.displayStatus !== "EXPIRED";
  const typeMeta = TYPE_META[link.linkType] ?? { icon: Shield, bg: "bg-slate-50 text-slate-400" };
  const TypeIcon = typeMeta.icon;
  const statusCfg = STATUS_CONFIG[link.displayStatus];

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${link.token}`
      : `/secure/${link.token}`;

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(secureUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteLink(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this link? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${link.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {/* Row */}
      <div
        className="group flex sm:grid sm:grid-cols-[2fr_1.2fr_120px_160px_auto] gap-4 px-5 py-3.5 items-center transition-colors cursor-pointer hover:bg-slate-50/60"
        onClick={() => router.push(`/dashboard/links/${link.id}`)}
      >
        {/* Client */}
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", typeMeta.bg)}>
            <TypeIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
              {link.clientName ?? (
                <span className="text-slate-400 font-normal italic">No name</span>
              )}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {link.clientEmail ?? LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
            </p>
          </div>
        </div>

        {/* Type — desktop */}
        <div className="hidden sm:block text-sm text-slate-600 truncate">
          {LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1", statusCfg.badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusCfg.dot)} />
            {statusCfg.label}
          </span>
        </div>

        {/* Created — desktop */}
        <div className="hidden sm:block text-xs text-slate-400 tabular-nums">
          {formatDate(link.createdAt)}
        </div>

        {/* Actions */}
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
          <RowAction
            icon={deleting ? Loader2 : Trash2}
            label="Delete"
            danger
            spinIcon={deleting}
            disabled={deleting}
            onClick={deleteLink}
          />
        </div>
      </div>

      {/* Inline send panel */}
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

// ── Send Panel ───────────────────────────────────────────────────────────────

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

  const [method, setMethod] = useState<"SMS" | "EMAIL" | "COPY">(twilioEnabled ? "SMS" : "EMAIL");
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
    if (method === "COPY") await navigator.clipboard.writeText(message);

    const res = await fetch(`/api/links/${link.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, recipient, message }),
    });
    setSending(false);
    if (res.ok) {
      setSuccess(true);
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
    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Send secure link</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Method tabs */}
      <div className="flex gap-1.5 mb-3">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              method === m
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {m === "SMS" ? "SMS" : m === "EMAIL" ? "Email" : "Copy link"}
          </button>
        ))}
      </div>

      {/* Recipient input */}
      {method === "SMS" && (
        <Input
          value={smsTo}
          onChange={(e) => setSmsTo(e.target.value)}
          placeholder="+1 555-000-0000"
          className="h-8 text-sm mb-2 bg-white"
        />
      )}
      {method === "EMAIL" && (
        <Input
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
          placeholder="client@email.com"
          className="h-8 text-sm mb-2 bg-white"
        />
      )}

      {/* Message textarea */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      {success ? (
        <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1.5">
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
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Row action button ────────────────────────────────────────────────────────

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
    "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
    disabled && "opacity-40 pointer-events-none",
    danger
      ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
      : active
      ? "text-emerald-700 bg-emerald-50"
      : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
