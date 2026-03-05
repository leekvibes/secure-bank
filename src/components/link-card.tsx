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

interface LinkCardProps {
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
  };
  twilioEnabled?: boolean;
}

export function LinkCard({ link, twilioEnabled = false }: LinkCardProps) {
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
      // User cancelled share dialog or clipboard permission was denied.
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

  const statusColor =
    LINK_STATUS_COLORS[link.status] ?? "bg-slate-100 text-slate-600 ring-slate-200/70";
  const expired = isExpired(link.expiresAt);
  const canAct = !expired && link.status !== "SUBMITTED";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm">
              {LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${statusColor}`}
            >
              {LINK_STATUS_LABELS[link.status] ?? link.status}
            </span>
            {link.submission?.revealedAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                <Eye className="w-3 h-3" />
                Revealed
              </span>
            )}
          </div>

          {link.clientName && (
            <div className="flex items-center gap-1 mt-1.5 text-sm text-slate-500">
              <User className="w-3.5 h-3.5" />
              {link.clientName}
            </div>
          )}

          <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {expired ? "Expired" : "Expires"} {formatDate(link.expiresAt)}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {canAct && (
            <Button variant="outline" size="sm" onClick={handleShare} className="text-xs">
              {shared ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
              {shared ? "Shared" : "Share"}
            </Button>
          )}
          {canAct && (
            <Button variant="outline" size="sm" onClick={copyLink} className="text-xs">
              {copied ? (
                <CheckCheck className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          {canAct && twilioEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSms((v) => !v)}
              className="text-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              SMS
            </Button>
          )}
          {link.submission && (
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href={`/dashboard/submissions/${link.submission.id}`}>
                View
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteLink}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* SMS panel */}
      {showSms && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="text-xs text-slate-500 mb-2">
            Send the secure link directly via SMS.
          </p>
          {smsSent ? (
            <p className="text-xs text-green-600 font-medium">SMS sent!</p>
          ) : (
            <div className="flex gap-2">
              <Input
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+1 555-000-0000"
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                onClick={sendSms}
                disabled={smsSending || !smsTo.trim()}
              >
                {smsSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          )}
          {smsError && (
            <p className="text-xs text-red-600 mt-1">{smsError}</p>
          )}
        </div>
      )}
    </div>
  );
}
