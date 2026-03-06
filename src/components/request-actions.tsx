"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy, CheckCheck, Send, Eye, Trash2, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildTrustMessage } from "@/lib/link-message";

interface Props {
  linkId: string;
  linkToken: string;
  linkType: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  destination: string | null;
  displayStatus: string;
  submissionId: string | null;
  idUploadId: string | null;
  twilioEnabled: boolean;
}

export function RequestActions({
  linkId,
  linkToken,
  linkType,
  clientName,
  clientPhone,
  clientEmail,
  destination,
  displayStatus,
  submissionId,
  idUploadId,
  twilioEnabled,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canAct = displayStatus !== "SUBMITTED" && displayStatus !== "EXPIRED";

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${linkToken}`
      : `/secure/${linkToken}`;

  const viewHref = idUploadId
    ? `/dashboard/uploads/${idUploadId}`
    : submissionId
    ? `/dashboard/submissions/${submissionId}`
    : null;

  function copyLink() {
    navigator.clipboard.writeText(secureUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteRequest() {
    if (!confirm("Delete this request? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${linkId}`, { method: "DELETE" });
    router.push("/dashboard/links");
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/40 p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Actions</h3>
      <div className="space-y-2">
        {canAct && (
          <ActionButton
            icon={Send}
            label={showSend ? "Close send panel" : "Send again"}
            active={showSend}
            onClick={() => setShowSend((o) => !o)}
          />
        )}
        {canAct && (
          <ActionButton
            icon={copied ? CheckCheck : Copy}
            label={copied ? "Copied!" : "Copy link"}
            active={copied}
            onClick={copyLink}
          />
        )}
        {viewHref && (
          <Link
            href={viewHref}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-4 h-4 shrink-0" />
            {idUploadId ? "View ID upload" : "Reveal submission"}
          </Link>
        )}
        <ActionButton
          icon={deleting ? Loader2 : Trash2}
          label="Delete request"
          danger
          spinIcon={deleting}
          disabled={deleting}
          onClick={deleteRequest}
        />
      </div>

      {/* Inline send panel */}
      {showSend && (
        <SendPanel
          linkId={linkId}
          linkType={linkType}
          clientName={clientName}
          clientPhone={clientPhone}
          clientEmail={clientEmail}
          destination={destination}
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
  linkId,
  linkType,
  clientName,
  clientPhone,
  clientEmail,
  destination,
  secureUrl,
  twilioEnabled,
  onClose,
  onSent,
}: {
  linkId: string;
  linkType: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  destination: string | null;
  secureUrl: string;
  twilioEnabled: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const defaultMsg = buildTrustMessage({
    clientName,
    destination: destination ?? "Internal processing",
    linkType,
    url: secureUrl,
  });

  const [method, setMethod] = useState<"SMS" | "EMAIL" | "COPY">(twilioEnabled ? "SMS" : "EMAIL");
  const [smsTo, setSmsTo] = useState(clientPhone ?? "");
  const [emailTo, setEmailTo] = useState(clientEmail ?? "");
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
    const res = await fetch(`/api/links/${linkId}/send`, {
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

  const methods = (["SMS", "EMAIL", "COPY"] as const).filter((m) => m !== "SMS" || twilioEnabled);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Send secure link</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
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
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            {m === "SMS" ? "SMS" : m === "EMAIL" ? "Email" : "Copy"}
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
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : method === "COPY" ? "Copy" : "Send now"}
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

// ── Shared action button ─────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
  active = false,
  disabled = false,
  spinIcon = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  spinIcon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
        disabled && "opacity-50 pointer-events-none",
        danger
          ? "border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200"
          : active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", spinIcon && "animate-spin")} />
      {label}
    </button>
  );
}
