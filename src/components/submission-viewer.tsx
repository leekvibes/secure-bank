"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Eye, EyeOff, Shield, Clock, Download, Trash2, Share2,
  CheckCheck, Lock, Send, Plus, CheckCircle2, AlertCircle, Calendar,
  CreditCard, ClipboardList, Camera, Hash, Loader2, User,
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
  LINK_CREATED:  { label: "Link created",              icon: Plus,         iconBg: "bg-slate-500/10",   iconColor: "text-slate-500" },
  LINK_SENT:     { label: "Link sent to client",       icon: Send,         iconBg: "bg-blue-500/10",    iconColor: "text-blue-500" },
  LINK_OPENED:   { label: "Link opened by client",     icon: Eye,          iconBg: "bg-amber-500/10",   iconColor: "text-amber-600" },
  SUBMITTED:     { label: "Client submitted form",     icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
  REVEALED:      { label: "Agent revealed data",       icon: Eye,          iconBg: "bg-blue-500/10",    iconColor: "text-blue-600" },
  SSN_OPENED:    { label: "SSN link opened by client", icon: Eye,          iconBg: "bg-amber-500/10",   iconColor: "text-amber-600" },
  SSN_SUBMITTED: { label: "SSN form submitted",        icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
  SSN_REVEALED:  { label: "Agent revealed SSN data",   icon: Eye,          iconBg: "bg-blue-500/10",    iconColor: "text-blue-600" },
  EXPORTED:      { label: "Data exported",             icon: Download,     iconBg: "bg-blue-500/10",    iconColor: "text-blue-600" },
  DELETED:       { label: "Submission deleted",         icon: Trash2,       iconBg: "bg-red-500/10",     iconColor: "text-red-500" },
  EXPIRED:       { label: "Link expired",              icon: AlertCircle,  iconBg: "bg-red-500/10",     iconColor: "text-red-500" },
};

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string; gradient: string;
}> = {
  BANKING_INFO: { icon: CreditCard,    iconColor: "text-blue-500",    gradient: "from-blue-500/8 via-blue-500/3 to-transparent" },
  SSN_ONLY:     { icon: Shield,        iconColor: "text-violet-500",  gradient: "from-violet-500/8 via-violet-500/3 to-transparent" },
  FULL_INTAKE:  { icon: ClipboardList, iconColor: "text-emerald-500", gradient: "from-emerald-500/8 via-emerald-500/3 to-transparent" },
  ID_UPLOAD:    { icon: Camera,        iconColor: "text-orange-500",  gradient: "from-orange-500/8 via-orange-500/3 to-transparent" },
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const typeMeta = TYPE_META[submission.link.linkType] ?? TYPE_META.FULL_INTAKE;
  const TypeIcon = typeMeta.icon;
  const typeLabel = LINK_TYPES[submission.link.linkType as LinkType] ?? submission.link.linkType;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/links/${submission.link.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.error ?? "Failed to delete submission.");
        setDeleting(false);
        setDeleteConfirm(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Failed to delete submission. Please try again.");
      setDeleting(false);
      setDeleteConfirm(false);
    }
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
    <div className="max-w-3xl animate-fade-in">

      <Link
        href="/dashboard/submissions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Back to Submissions
      </Link>

      <div className="rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/[0.03] overflow-hidden mb-6">
        <div className={cn("bg-gradient-to-br px-8 py-7", typeMeta.gradient)}>
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0 ring-2 ring-primary/15">
              <TypeIcon className={cn("w-7 h-7", typeMeta.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {submission.link.clientName ?? "Submission"}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{typeLabel}</p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Submitted
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/8 text-emerald-600">
                  <Lock className="w-2.5 h-2.5" />
                  Encrypted
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40 border-t border-border/40 bg-muted/20">
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Submitted</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatDate(submission.createdAt)}</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Expires</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatDate(submission.deleteAt)}</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Revealed</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{submission.revealCount} time{submission.revealCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Hash className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Type</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{typeLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl gap-1.5 h-9">
          {shared ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
          {shared ? "Shared" : "Share Link"}
        </Button>
        <Button variant="outline" size="sm" asChild className="rounded-xl gap-1.5 h-9">
          <a href={exportUrl("json")} download>
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild className="rounded-xl gap-1.5 h-9">
          <a href={exportUrl("text")} download>
            <Download className="w-3.5 h-3.5" />
            Export TXT
          </a>
        </Button>
        <div className="ml-auto">
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)} className="rounded-xl h-9">
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl h-9 text-red-500 bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              className="rounded-xl h-9 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-xl bg-red-500/8 border border-red-500/15 px-4 py-3 mb-6 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-primary" />
              Submitted Data
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Submitted {formatDate(submission.createdAt)}
              {submission.revealCount > 0 &&
                ` · Revealed ${submission.revealCount} time${submission.revealCount > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="p-6">
            {maskedSsn && !revealed && (
              <div className="mb-5 rounded-xl bg-violet-500/5 border border-violet-500/15 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">SSN (Masked)</p>
                  <p className="font-mono text-foreground text-base font-semibold tracking-widest">{maskedSsn}</p>
                </div>
              </div>
            )}
            {revealed && fields ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-emerald-600">Data decrypted successfully</span>
                </div>

                <div className="rounded-xl border border-border/40 overflow-hidden">
                  {Object.entries(fields).map(([key, value], i) => (
                    <div
                      key={key}
                      className={cn(
                        "flex gap-4 px-5 py-3.5",
                        i % 2 === 0 ? "bg-muted/15" : "bg-transparent",
                        i < Object.entries(fields).length - 1 && "border-b border-border/30"
                      )}
                    >
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-44 shrink-0 pt-0.5">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="text-sm font-mono text-foreground break-all flex-1">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRevealed(false); setFields(null); }}
                  className="rounded-xl gap-1.5"
                >
                  <EyeOff className="w-4 h-4" />
                  Hide Data
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-10 gap-5">
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center ring-4 ring-primary/5">
                  <Lock className="w-8 h-8 text-primary/40" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Data is encrypted</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Click below to decrypt and reveal the submitted information securely.
                  </p>
                </div>
                {error && (
                  <div className="text-sm text-red-500 bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-2.5">
                    {error}
                  </div>
                )}
                <Button onClick={revealData} disabled={loading} className="rounded-xl px-8 h-11 gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {loading ? "Decrypting..." : "Reveal Submission"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-muted/30 to-transparent border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Activity Log
              <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                {auditLogs.length} event{auditLogs.length !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>
          <div className="p-6">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No activity recorded</p>
              </div>
            ) : (
              <div className="space-y-0">
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
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 ring-1 ring-offset-2 ring-offset-card",
                          iconBg,
                          iconBg.replace("bg-", "ring-").replace("/100", "/30").replace("/10", "/20")
                        )}>
                          <EventIcon className={cn("w-4 h-4", iconColor)} />
                        </div>
                        {i < auditLogs.length - 1 && (
                          <div className="w-px flex-1 min-h-[24px] bg-gradient-to-b from-border to-border/20 my-1.5" />
                        )}
                      </div>
                      <div className={cn("min-w-0 flex-1", i < auditLogs.length - 1 ? "pb-6" : "pb-0")}>
                        <p className="text-sm font-medium text-foreground mt-2 leading-none">
                          {label}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1 tabular-nums">
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
    </div>
  );
}
