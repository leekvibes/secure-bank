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
import { getInitialSendMethod } from "@/lib/request-send";
import { toast } from "@/components/ui/use-toast";

interface Props {
  linkId: string;
  linkToken: string;
  linkType: string;
  clientName: string | null;
  clientEmail: string | null;
  destination: string | null;
  displayStatus: string;
  submissionId: string | null;
  idUploadId: string | null;
}

export function RequestActions({
  linkId,
  linkToken,
  linkType,
  clientName,
  clientEmail,
  destination,
  displayStatus,
  submissionId,
  idUploadId,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  async function deleteRequest() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/links/${linkId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast({
          title: "Delete failed",
          description: payload?.error ?? "Failed to delete request.",
          variant: "destructive",
        });
        return;
      }
      router.push("/dashboard/links");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
          <Send className="w-3 h-3 text-primary" />
        </span>
        Actions
      </h3>
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
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-medium hover:from-primary/90 hover:to-primary/80 transition-all duration-200 shadow-md shadow-primary/20 ring-1 ring-primary/20"
          >
            <span className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Eye className="w-3.5 h-3.5" />
            </span>
            {idUploadId ? "View ID upload" : "Reveal submission"}
          </Link>
        )}
        {deleteConfirm ? (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 px-3 py-2 rounded-xl border border-border/60 text-muted-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={deleteRequest}
              disabled={deleting}
              className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-medium hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition-all duration-200 shadow-sm shadow-red-500/20 flex items-center justify-center gap-1.5"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {deleting ? "Deleting..." : "Confirm delete"}
            </button>
          </div>
        ) : (
          <ActionButton
            icon={Trash2}
            label="Delete request"
            danger
            onClick={() => setDeleteConfirm(true)}
          />
        )}
      </div>

      {showSend && (
        <SendPanel
          linkId={linkId}
          linkType={linkType}
          clientName={clientName}
          clientEmail={clientEmail}
          destination={destination}
          secureUrl={secureUrl}
          onClose={() => setShowSend(false)}
          onSent={() => { setShowSend(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SendPanel({
  linkId,
  linkType,
  clientName,
  clientEmail,
  destination,
  secureUrl,
  onClose,
  onSent,
}: {
  linkId: string;
  linkType: string;
  clientName: string | null;
  clientEmail: string | null;
  destination: string | null;
  secureUrl: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const defaultMsg = buildTrustMessage({
    clientName,
    destination: destination ?? "Internal processing",
    linkType,
    url: secureUrl,
  });

  const [method, setMethod] = useState<"EMAIL" | "COPY">(
    getInitialSendMethod({
      clientEmail,
    })
  );
  const [emailTo, setEmailTo] = useState(clientEmail ?? "");
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
    const res = await fetch(`/api/links/${linkId}/send`, {
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
    <div className="mt-4 pt-4 border-t border-border/30 bg-gradient-to-b from-surface-2/40 to-transparent rounded-b-xl">
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
        <div className="mt-2 flex items-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}

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
        "flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 group/action",
        disabled && "opacity-50 pointer-events-none",
        danger
          ? "border-border/60 text-red-500 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-transparent hover:border-red-500/30 hover:shadow-sm hover:shadow-red-500/10"
          : active
          ? "border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent text-emerald-600 shadow-sm shadow-emerald-500/10"
          : "border-border/60 text-foreground hover:bg-gradient-to-r hover:from-accent hover:to-transparent hover:border-primary/20 hover:shadow-sm"
      )}
    >
      <span className={cn(
        "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200",
        danger
          ? "bg-red-500/10 group-hover/action:bg-red-500/20"
          : active
          ? "bg-emerald-500/15"
          : "bg-muted/60 group-hover/action:bg-primary/10"
      )}>
        <Icon className={cn("w-3.5 h-3.5", spinIcon && "animate-spin")} />
      </span>
      {label}
    </button>
  );
}
