"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy, CheckCheck, Share2, Eye, MessageSquare,
  Trash2, Loader2, ImageIcon, User, Calendar, Clock, Mail,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LINK_TYPES,
  LINK_STATUS_LABELS,
  LINK_STATUS_COLORS,
  formatDate,
  isExpired,
  type LinkType,
  cn,
} from "@/lib/utils";
import { shareLink } from "@/lib/share";
import { buildTrustMessage } from "@/lib/link-message";
import { toast } from "@/components/ui/use-toast";

interface LinkRowProps {
  link: {
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
  };
  twilioEnabled?: boolean;
}

export function LinkRow({ link, twilioEnabled = false }: LinkRowProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendMethod, setSendMethod] = useState<"SMS" | "EMAIL" | "COPY">("SMS");
  const [smsTo, setSmsTo] = useState(link.clientPhone ?? "");
  const [emailTo, setEmailTo] = useState(link.clientEmail ?? "");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${link.token}`
      : `/secure/${link.token}`;

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
      .catch(() => {
        toast({
          title: "Clipboard failed",
          description: "Unable to copy link in this browser.",
          variant: "destructive",
        });
      });
  }

  async function handleShare() {
    try {
      const result = await shareLink({
        title: "Secure Submission Link",
        text: "Use this private encrypted link to submit your information securely.",
        url: secureUrl,
      });
      if (result === "shared") {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
    }
  }

  async function sendNow() {
    setSending(true);
    setSendError(null);

    const recipient =
      sendMethod === "SMS"
        ? smsTo.trim()
        : sendMethod === "EMAIL"
        ? emailTo.trim()
        : "clipboard";

    if (sendMethod === "COPY") {
      try {
        await navigator.clipboard.writeText(sendMessage);
      } catch {
        setSending(false);
        setSendError("Unable to copy message in this browser.");
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
      body: JSON.stringify({
        method: sendMethod,
        recipient,
        message: sendMessage,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setSendError(data.error?.message ?? data.error ?? "Failed to send.");
    } else {
      toast({
        title: sendMethod === "SMS" ? "SMS sent" : sendMethod === "EMAIL" ? "Email sent" : "Link copied",
        description: sendMethod === "COPY" ? "Message copied to clipboard." : "Link sent successfully.",
      });
      setSendSuccess(true);
      setTimeout(() => {
        setShowSend(false);
        setSendSuccess(false);
      }, 1500);
      router.refresh();
    }
  }

  async function deleteLink() {
    if (!confirm("Delete this link? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/links/${link.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Delete failed",
          description: data.error ?? "Failed to delete link.",
          variant: "destructive",
        });
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const expired = isExpired(link.expiresAt);
  const statusKey = expired && link.status !== "SUBMITTED" ? "EXPIRED" : link.status;
  const statusColor = LINK_STATUS_COLORS[statusKey] ?? "bg-muted/60 text-muted-foreground ring-border/40";
  const canAct = !expired && link.status !== "SUBMITTED" && link.status !== "EXPIRED";
  const isIdUpload = link.linkType === "ID_UPLOAD";

  const viewHref = isIdUpload && link.idUpload
    ? `/dashboard/uploads/${link.idUpload.id}`
    : link.submission
    ? `/dashboard/submissions/${link.submission.id}`
    : null;

  const hasViewed = isIdUpload ? !!link.idUpload?.viewedAt : !!link.submission?.revealedAt;
  const typeLabel = LINK_TYPES[link.linkType as LinkType] ?? link.linkType;
  const title = link.clientName ?? typeLabel;
  const sentCount = link._count?.sends ?? 0;
  const lastSend = link.sends?.[0] ?? null;
  const defaultMessage = buildTrustMessage({
    clientName: link.clientName,
    destination: link.destination ?? "Internal processing",
    linkType: link.linkType,
    url: secureUrl,
  });

  return (
    <div className="glass-card rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-glow-sm">

      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center mt-0.5">
            {isIdUpload
              ? <ImageIcon className="w-4 h-4 text-muted-foreground" />
              : <User className="w-4 h-4 text-muted-foreground" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">{title}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${statusColor}`}>
                {LINK_STATUS_LABELS[statusKey] ?? statusKey}
              </span>
              {hasViewed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-violet-500/20 bg-violet-500/10 text-violet-400">
                  <Eye className="w-3 h-3" />
                  Viewed
                </span>
              )}
              {sentCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-primary/20 bg-primary/10 text-primary">
                  <CheckCheck className="w-3 h-3" />
                  Sent
                </span>
              )}
            </div>
            {link.clientName && (
              <p className="text-xs text-muted-foreground mt-0.5">{typeLabel}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pl-[52px] text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {formatDate(link.createdAt)}
          </span>
          <span className="text-border select-none">|</span>
          <span className={expired ? "flex items-center gap-1.5 text-red-400" : "flex items-center gap-1.5"}>
            <Clock className="w-3 h-3" />
            {expired ? "Expired" : "Expires"} {formatDate(link.expiresAt)}
          </span>
          {lastSend && (
            <>
              <span className="text-border select-none">|</span>
              <span className="truncate max-w-[280px]">
                Sent via {lastSend.method.toLowerCase()} to {lastSend.recipient}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-4 py-2 border-t border-border/30">
        {canAct && (
          <ActionBtn
            icon={shared ? CheckCheck : Share2}
            label={shared ? "Shared" : "Send"}
            onClick={() => {
              setShowSend((open) => !open);
              setSendMessage(defaultMessage);
              setSendError(null);
            }}
            active={showSend || shared}
          />
        )}
        {canAct && (
          <ActionBtn
            icon={copied ? CheckCheck : Copy}
            label={copied ? "Copied" : "Copy link"}
            onClick={copyLink}
            active={copied}
          />
        )}
        {canAct && twilioEnabled && (
          <ActionBtn
            icon={MessageSquare}
            label="SMS"
            onClick={() => {
              setShowSend((open) => !open);
              setSendMethod("SMS");
              setSendMessage(defaultMessage);
            }}
            active={showSend && sendMethod === "SMS"}
          />
        )}
        {canAct && (
          <ActionBtn
            icon={Mail}
            label="Email"
            onClick={() => {
              setShowSend((open) => !open);
              setSendMethod("EMAIL");
              setSendMessage(defaultMessage);
            }}
            active={showSend && sendMethod === "EMAIL"}
          />
        )}
        {viewHref && (
          <ActionBtn icon={Eye} label="View submission" href={viewHref} />
        )}
        <div className="ml-auto">
          <ActionBtn
            icon={deleting ? Loader2 : Trash2}
            label="Delete"
            onClick={deleteLink}
            danger
            disabled={deleting}
            spinIcon={deleting}
          />
        </div>
      </div>

      {showSend && (
        <div className="border-t border-border/30 px-5 py-3.5 bg-surface-2/50 backdrop-blur-sm rounded-b-xl">
          <p className="text-xs font-medium text-muted-foreground mb-2">Send secure link</p>
          <div className="flex gap-1.5 mb-2">
            <Button size="sm" variant={sendMethod === "SMS" ? "default" : "outline"} className="h-8" onClick={() => setSendMethod("SMS")}>SMS</Button>
            <Button size="sm" variant={sendMethod === "EMAIL" ? "default" : "outline"} className="h-8" onClick={() => setSendMethod("EMAIL")}>Email</Button>
            <Button size="sm" variant={sendMethod === "COPY" ? "default" : "outline"} className="h-8" onClick={() => setSendMethod("COPY")}>Copy link</Button>
          </div>
          {sendMethod === "SMS" && (
            <Input
              value={smsTo}
              onChange={(e) => setSmsTo(e.target.value)}
              placeholder="+1 555-000-0000"
              className="h-8 text-sm mb-2"
            />
          )}
          {sendMethod === "EMAIL" && (
            <Input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="client@email.com"
              className="h-8 text-sm mb-2"
            />
          )}
          <textarea
            value={sendMessage}
            onChange={(e) => setSendMessage(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors"
          />
          {sendSuccess ? (
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              Sent successfully
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={sendNow}
              disabled={
                sending ||
                (sendMethod === "SMS" && !smsTo.trim()) ||
                (sendMethod === "EMAIL" && !emailTo.trim()) ||
                !sendMessage.trim()
              }
              className="h-8 shrink-0"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} className="h-8">
              Share native
            </Button>
          </div>
          {sendError && <p className="text-xs text-red-400 mt-1.5">{sendError}</p>}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
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
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  spinIcon?: boolean;
}) {
  const cls = cn(
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 select-none",
    disabled && "opacity-50 pointer-events-none",
    danger
      ? "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
      : active
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-muted-foreground hover:text-foreground hover:bg-accent"
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      <Icon className={cn("w-3.5 h-3.5", spinIcon && "animate-spin")} />
      {label}
    </button>
  );
}
