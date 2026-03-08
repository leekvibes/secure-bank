"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Eye, EyeOff, Shield, Clock, Download, Trash2, Share2,
  CheckCheck, Lock, Send, Plus, CheckCircle2, AlertCircle, Calendar,
  CreditCard, ClipboardList, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, LINK_TYPES, formatDate, type LinkType } from "@/lib/utils";
import { shareLink } from "@/lib/share";

interface SubmissionViewerProps {
  submission: {
    id: string;
    encryptedData: string;
    revealedAt: Date | null;
    revealCount: number;
    deleteAt: Date;
    createdAt: Date;
    link: {
      id: string;
      token: string;
      linkType: string;
      clientName: string | null;
      status: string;
    };
  };
  auditLogs: {
    id: string;
    event: string;
    createdAt: Date;
    userAgent: string | null;
  }[];
  maskedSsn?: string | null;
}

const EVENT_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}> = {
  LINK_CREATED:  { label: "Link created",             icon: Plus,         iconBg: "bg-slate-500/10",   iconColor: "text-slate-500" },
  LINK_SENT:     { label: "Link sent to client",      icon: Send,         iconBg: "bg-blue-500/10",    iconColor: "text-blue-500" },
  LINK_OPENED:   { label: "Link opened by client",    icon: Eye,          iconBg: "bg-amber-500/10",   iconColor: "text-amber-600" },
  SUBMITTED:     { label: "Client submitted form",    icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
  REVEALED:      { label: "Agent revealed data",      icon: Eye,          iconBg: "bg-blue-500/10",    iconColor: "text-blue-600" },
  SSN_OPENED:    { label: "SSN link opened by client", icon: Eye,         iconBg: "bg-amber-500/10",   iconColor: "text-amber-600" },
  SSN_SUBMITTED: { label: "SSN form submitted",       icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
  SSN_REVEALED:  { label: "Agent revealed SSN data",  icon: Eye,          iconBg: "bg-blue-500/10",    iconColor: "text-blue-600" },
  EXPORTED:      { label: "Data exported",            icon: Download,     iconBg: "bg-blue-500/10",    iconColor: "text-blue-600" },
  DELETED:       { label: "Submission deleted",       icon: Trash2,       iconBg: "bg-red-500/10",     iconColor: "text-red-500" },
  EXPIRED:       { label: "Link expired",             icon: AlertCircle,  iconBg: "bg-red-500/10",     iconColor: "text-red-500" },
};

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string; iconColor: string; border: string; gradient: string;
}> = {
  BANKING_INFO: { icon: CreditCard,    bg: "bg-blue-500/10",    iconColor: "text-blue-500",    border: "border-blue-500/20",    gradient: "from-blue-500/5 via-primary/5 to-transparent" },
  SSN_ONLY:     { icon: Shield,        bg: "bg-violet-500/10",  iconColor: "text-violet-500",  border: "border-violet-500/20",  gradient: "from-violet-500/5 via-primary/5 to-transparent" },
  FULL_INTAKE:  { icon: ClipboardList, bg: "bg-emerald-500/10", iconColor: "text-emerald-500", border: "border-emerald-500/20", gradient: "from-emerald-500/5 via-primary/5 to-transparent" },
  ID_UPLOAD:    { icon: Camera,        bg: "bg-orange-500/10",  iconColor: "text-orange-500",  border: "border-orange-500/20",  gradient: "from-orange-500/5 via-primary/5 to-transparent" },
};

export function SubmissionViewer({
  submission,
  auditLogs,
  maskedSsn,
}: SubmissionViewerProps) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shared, setShared] = useState(false);

  const alreadyRevealed = submission.revealedAt !== null;
  const typeMeta = TYPE_META[submission.link.linkType] ?? TYPE_META.FULL_INTAKE;
  const TypeIcon = typeMeta.icon;
  const typeLabel = LINK_TYPES[submission.link.linkType as LinkType] ?? submission.link.linkType;

  async function handleDelete() {
    if (!confirm("Permanently delete this submission and its link? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${submission.link.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  function exportUrl(format: string) {
    return `/api/submissions/${submission.id}/export?format=${format}`;
  }

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${submission.link.token}`
      : `/secure/${submission.link.token}`;

  async function handleShare() {
    try {
      const result = await shareLink({
        title: "Secure Submission Link",
        text: "Use this private encrypted link to submit your information securely.",
        url: secureUrl,
      });
      if (result === "shared" || result === "copied") {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
    }
  }

  async function revealData() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/submissions/${submission.id}/reveal`, {
      method: "POST",
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to reveal data.");
      return;
    }

    setFields(data.fields);
    setRevealed(true);
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">

      <Link
        href="/dashboard/links"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to requests
      </Link>

      <div className={cn(
        "bg-card rounded-xl border border-border shadow-sm p-6 bg-gradient-to-br",
        typeMeta.gradient
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
            typeMeta.bg, typeMeta.border
          )}>
            <TypeIcon className={cn("w-6 h-6", typeMeta.iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground leading-tight">Submission</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 bg-emerald-500/10 text-emerald-600 ring-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Submitted
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 bg-primary/10 text-primary ring-primary/20">
                <Lock className="w-3 h-3" />
                Encrypted
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{typeLabel}</p>
            {submission.link.clientName && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">{submission.link.clientName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Submitted {formatDate(submission.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Expires {formatDate(submission.deleteAt)}</span>
          </div>
          {submission.revealCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>Revealed {submission.revealCount} time{submission.revealCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="rounded-xl"
        >
          {shared ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
          {shared ? "Shared" : "Share link"}
        </Button>
        <Button variant="outline" size="sm" asChild className="rounded-xl">
          <a href={exportUrl("json")} download>
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild className="rounded-xl">
          <a href={exportUrl("text")} download>
            <Download className="w-3.5 h-3.5" />
            Export TXT
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-xl text-red-500 hover:bg-red-500/10 hover:border-red-500/30 ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Submitted data
          </h2>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Submitted {formatDate(submission.createdAt)}
            {submission.revealCount > 0 &&
              ` · Revealed ${submission.revealCount} time${submission.revealCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="p-6">
          {maskedSsn && !revealed && (
            <div className="mb-4 rounded-xl border border-border/40 bg-surface-2 p-3.5 text-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">SSN (masked)</span>
                <p className="font-mono text-foreground text-sm">{maskedSsn}</p>
              </div>
            </div>
          )}
          {revealed && fields ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium">Data decrypted successfully</span>
              </div>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                {Object.entries(fields).map(([key, value], i) => (
                  <div
                    key={key}
                    className={cn(
                      "flex gap-4 px-4 py-3",
                      i % 2 === 0 ? "bg-surface-2/50" : "bg-transparent",
                      i < Object.entries(fields).length - 1 && "border-b border-border/30"
                    )}
                  >
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-40 shrink-0 pt-0.5">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-sm font-mono text-foreground break-all">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRevealed(false); setFields(null); }}
                className="rounded-xl"
              >
                <EyeOff className="w-4 h-4" />
                Hide data
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center border border-primary/10 ring-4 ring-primary/5">
                <Lock className="w-7 h-7 text-primary/60" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Data is encrypted</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Click below to decrypt and reveal the submitted information securely.
                </p>
              </div>
              {error && (
                <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {error}
                </div>
              )}
              <Button onClick={revealData} disabled={loading} className="rounded-xl px-6">
                <Eye className="w-4 h-4" />
                {loading ? "Decrypting…" : "Reveal submission"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Activity log
          </h2>
        </div>
        <div className="p-6">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            <div>
              {auditLogs.map((log, i) => {
                const cfg = EVENT_CONFIG[log.event];
                const EventIcon = cfg?.icon ?? Clock;
                const label = cfg?.label ?? log.event;
                const iconBg = cfg?.iconBg ?? "bg-slate-500/10";
                const iconColor = cfg?.iconColor ?? "text-slate-500";

                return (
                  <div key={log.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10",
                        iconBg
                      )}>
                        <EventIcon className={cn("w-3.5 h-3.5", iconColor)} />
                      </div>
                      {i < auditLogs.length - 1 && (
                        <div className="w-px flex-1 min-h-[20px] bg-border my-1" />
                      )}
                    </div>
                    <div className={cn("min-w-0", i < auditLogs.length - 1 ? "pb-5" : "pb-0")}>
                      <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1 tabular-nums">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
