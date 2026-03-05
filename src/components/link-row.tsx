"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Copy,
  CheckCheck,
  Share2,
  ChevronRight,
  User,
  Eye,
  MessageSquare,
  Trash2,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LINK_TYPES,
  LINK_STATUS_LABELS,
  LINK_STATUS_COLORS,
  formatDate,
  isExpired,
  type LinkType,
} from "@/lib/utils";
import { shareLink } from "@/lib/share";

interface LinkRowProps {
  link: {
    id: string;
    token: string;
    linkType: string;
    clientName: string | null;
    clientPhone: string | null;
    status: string;
    expiresAt: Date;
    createdAt: Date;
    submission: { id: string; revealedAt: Date | null } | null;
    idUpload: { id: string; viewedAt: Date | null } | null;
  };
  twilioEnabled?: boolean;
}

export function LinkRow({ link, twilioEnabled = false }: LinkRowProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const [smsTo, setSmsTo] = useState(link.clientPhone ?? "");
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${link.token}`
      : `/secure/${link.token}`;

  function copyLink() {
    navigator.clipboard.writeText(secureUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      // User cancelled
    }
  }

  async function sendSms() {
    setSmsSending(true);
    setSmsError(null);
    const res = await fetch(`/api/links/${link.id}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: smsTo }),
    });
    const data = await res.json();
    setSmsSending(false);
    if (!res.ok) {
      setSmsError(data.error ?? "Failed to send SMS.");
    } else {
      setSmsSent(true);
      setTimeout(() => { setShowSms(false); setSmsSent(false); }, 2000);
    }
  }

  async function deleteLink() {
    if (!confirm("Delete this link? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${link.id}`, { method: "DELETE" });
    router.refresh();
  }

  const expired = isExpired(link.expiresAt);
  const statusKey = expired && link.status !== "SUBMITTED" ? "EXPIRED" : link.status;
  const statusColor = LINK_STATUS_COLORS[statusKey] ?? "bg-slate-100 text-slate-500 ring-slate-200/60";
  const canAct = !expired && link.status !== "SUBMITTED" && link.status !== "EXPIRED";
  const isIdUpload = link.linkType === "ID_UPLOAD";

  const viewHref = isIdUpload && link.idUpload
    ? `/dashboard/uploads/${link.idUpload.id}`
    : link.submission
    ? `/dashboard/submissions/${link.submission.id}`
    : null;

  const hasViewed = isIdUpload ? !!link.idUpload?.viewedAt : !!link.submission?.revealedAt;

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
          {isIdUpload ? (
            <ImageIcon className="w-4 h-4 text-slate-400" />
          ) : (
            <User className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-900 truncate">
              {link.clientName ?? (LINK_TYPES[link.linkType as LinkType] ?? link.linkType)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${statusColor}`}
            >
              {LINK_STATUS_LABELS[statusKey] ?? statusKey}
            </span>
            {hasViewed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-purple-200/60 bg-purple-50 text-purple-700">
                <Eye className="w-3 h-3" />
                Viewed
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">
              {LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {expired ? "Expired" : "Expires"} {formatDate(link.expiresAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {canAct && (
            <Button variant="ghost" size="sm" onClick={handleShare} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
              {shared ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
            </Button>
          )}
          {canAct && (
            <Button variant="ghost" size="sm" onClick={copyLink} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
              {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          )}
          {canAct && twilioEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSms((v) => !v)}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}
          {viewHref && (
            <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900">
              <Link href={viewHref}>
                View
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteLink}
            disabled={deleting}
            className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* SMS panel */}
      {showSms && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2.5">
          <p className="text-xs text-slate-500 mb-2">Send the secure link via SMS.</p>
          {smsSent ? (
            <p className="text-xs text-green-600 font-medium">SMS sent!</p>
          ) : (
            <div className="flex gap-2">
              <Input
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+1 555-000-0000"
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={sendSms} disabled={smsSending || !smsTo.trim()} className="h-8">
                {smsSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send"}
              </Button>
            </div>
          )}
          {smsError && <p className="text-xs text-red-600 mt-1">{smsError}</p>}
        </div>
      )}
    </div>
  );
}
