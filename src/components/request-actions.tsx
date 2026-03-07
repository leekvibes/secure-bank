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
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Actions</h3>
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
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 shadow-sm shadow-primary/20"
          >
            <Eye className="w-4 h-4 shrink-0" />
            {idUploadId ? "View ID upload" : "Reveal submission"}
          </Link>
        )}
        {deleteConfirm ? (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 px-3 py-2 rounded-lg border border-border/60 text-muted-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={deleteRequest}
              disabled={deleting}
              className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
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
    <div className="mt-4 pt-4 border-t border-border/30">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send secure link</p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors hover:bg-accent/60"
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
            {m === "EMAIL" ? "Email" : "Copy"}
          </button>
        ))}
      </div>

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
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
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
        "flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200",
        disabled && "opacity-50 pointer-events-none",
        danger
          ? "border-border/60 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
          : active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
          : "border-border/60 text-foreground hover:bg-accent hover:border-primary/20"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", spinIcon && "animate-spin")} />
      {label}
    </button>
  );
}
