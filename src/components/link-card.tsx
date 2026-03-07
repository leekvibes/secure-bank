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
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function LinkCard({ link }: LinkCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
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
    }
  }

  async function deleteLink() {
    if (!confirm("Delete this link? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${link.id}`, { method: "DELETE" });
    router.refresh();
  }

  const statusColor =
    LINK_STATUS_COLORS[link.status] ?? "bg-muted/60 text-muted-foreground ring-border/40";
  const expired = isExpired(link.expiresAt);
  const canAct = !expired && link.status !== "SUBMITTED";

  return (
    <div className="glass-card rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-glow-sm">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm">
              {LINK_TYPES[link.linkType as LinkType] ?? link.linkType}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${statusColor}`}
            >
              {LINK_STATUS_LABELS[link.status] ?? link.status}
            </span>
            {link.submission?.revealedAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-violet-500/10 text-violet-500 border-violet-500/20">
                <Eye className="w-3 h-3" />
                Revealed
              </span>
            )}
          </div>

          {link.clientName && (
            <div className="flex items-center gap-1 mt-1.5 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              {link.clientName}
            </div>
          )}

          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {expired ? "Expired" : "Expires"} {formatDate(link.expiresAt)}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {canAct && (
            <Button variant="outline" size="sm" onClick={handleShare} className="text-xs">
              {shared ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              {shared ? "Shared" : "Share"}
            </Button>
          )}
          {canAct && (
            <Button variant="outline" size="sm" onClick={copyLink} className="text-xs">
              {copied ? (
                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
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
            className="text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

    </div>
  );
}
