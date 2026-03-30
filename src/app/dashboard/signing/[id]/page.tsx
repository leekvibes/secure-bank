"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileText,
  LayoutTemplate,
  Loader2,
  Mail,
  Send,
  ShieldAlert,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { SigningOrderFlow } from "@/components/signing/signing-order-flow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RequestStatus = "DRAFT" | "SENT" | "OPENED" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type RecipientStatus = "PENDING" | "OPENED" | "COMPLETED" | "DECLINED";
type DetailTab = "OVERVIEW" | "RECIPIENTS" | "FIELDS" | "TIMELINE";

interface Recipient {
  id: string;
  name: string;
  email: string;
  order: number;
  status: RecipientStatus;
  completedAt: string | null;
  token: string;
  isAgent?: boolean;
  phone?: string | null;
}

interface AuditLog {
  id: string;
  event: string;
  metadata: string | null;
  createdAt: string;
}

interface SigningField {
  id: string;
  recipientId: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  required: boolean;
}

interface PageDim {
  page: number;
  widthPts: number;
  heightPts: number;
}

interface SigningRequestDetail {
  id: string;
  title: string | null;
  originalName: string | null;
  status: RequestStatus;
  displayStatus?: RequestStatus;
  signingMode: "PARALLEL" | "SEQUENTIAL" | string;
  expiresAt: string;
  completedAt: string | null;
  expiryReminderSentAt?: string | null;
  voidedAt: string | null;
  createdAt: string;
  blobUrl: string | null;
  signedBlobUrl: string | null;
  recipients: Recipient[];
  signingFields: SigningField[];
  pages: PageDim[];
  auditLogs: AuditLog[];
  certificate?: { blobUrl: string } | null;
  isEditable?: boolean;
}

function resolveDisplayStatus(request: SigningRequestDetail): RequestStatus {
  if (request.displayStatus) return request.displayStatus;
  const completedCount = request.recipients.filter((recipient) => recipient.status === "COMPLETED").length;
  if ((request.status === "SENT" || request.status === "OPENED") && completedCount > 0 && completedCount < request.recipients.length) {
    return "PARTIALLY_SIGNED";
  }
  return request.status;
}

function requestBadge(status: RequestStatus) {
  if (status === "DRAFT") return { label: "Draft", className: "bg-slate-200 text-slate-700" };
  if (status === "PARTIALLY_SIGNED") return { label: "Partially Signed", className: "bg-amber-100 text-amber-800" };
  if (status === "SENT" || status === "OPENED") return { label: "Sent", className: "bg-blue-100 text-blue-800" };
  if (status === "COMPLETED") return { label: "Completed", className: "bg-emerald-100 text-emerald-800" };
  if (status === "VOIDED") return { label: "Voided", className: "bg-orange-100 text-orange-800" };
  return { label: "Expired", className: "bg-rose-100 text-rose-800" };
}

function recipientStatusBadge(status: RecipientStatus) {
  if (status === "COMPLETED") return { label: "Signed", className: "bg-emerald-100 text-emerald-800" };
  if (status === "OPENED") return { label: "Opened", className: "bg-blue-100 text-blue-800" };
  if (status === "DECLINED") return { label: "Declined", className: "bg-rose-100 text-rose-800" };
  return { label: "Waiting", className: "bg-slate-200 text-slate-700" };
}

function eventLabel(event: string) {
  const map: Record<string, string> = {
    DOCUMENT_UPLOADED: "Document uploaded",
    SENT: "Request sent",
    OPENED: "Recipient opened",
    CONSENT: "Recipient consented",
    RECIPIENT_SIGNED: "Recipient completed assigned fields",
    COMPLETED: "All parties completed",
    DECLINED: "Recipient declined",
    VOIDED: "Request voided",
    REMINDER_SENT: "Reminder sent",
    RECIPIENT_REASSIGNED: "Recipient reassigned",
    DEADLINE_EXTENDED: "Deadline extended",
    CREATED_FROM_TEMPLATE: "Created from template",
    EXPIRY_REMINDER_SENT: "Expiry reminder sent",
  };
  return map[event] ?? event;
}

export default function SigningRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<SigningRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("OVERVIEW");

  const [voidBusy, setVoidBusy] = useState(false);
  const [remindBusy, setRemindBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<null | "signed" | "cert" | "original">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFormId, setResendFormId] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Recipient | null>(null);
  const [saveTemplateBusy, setSaveTemplateBusy] = useState(false);
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to load signing request.");
        const detail = (data?.request ?? data) as SigningRequestDetail;
        if (!cancelled) setRequest(detail);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load signing request.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const status = useMemo(() => (request ? resolveDisplayStatus(request) : null), [request]);
  const statusPill = status ? requestBadge(status) : null;
  const completedRecipients = request?.recipients.filter((recipient) => recipient.status === "COMPLETED").length ?? 0;
  const canRemind = status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED";
  const canVoid = status !== "COMPLETED" && status !== "VOIDED" && status !== "EXPIRED";
  const isEditable = request?.isEditable ?? status === "DRAFT";
  const canDelete = !!status; // any status can be deleted (API enforces soft-delete)
  const isExpiringSoon = request && (status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") && new Date(request.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && new Date(request.expiresAt).getTime() > Date.now();
  const canSaveTemplate = status === "SENT" || status === "COMPLETED";

  async function reload() {
    if (!id) return;
    const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to reload signing request.");
    setRequest((data?.request ?? data) as SigningRequestDetail);
  }

  async function handleRemind() {
    if (!id) return;
    setRemindBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/remind`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to send reminders.");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send reminders.");
    } finally {
      setRemindBusy(false);
    }
  }

  async function handleVoid() {
    if (!id) return;
    setVoidBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/void`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to void request.");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to void request.");
    } finally {
      setVoidBusy(false);
    }
  }

  function openResendForm(recipient: { id: string; email: string }) {
    setResendFormId(recipient.id);
    setResendEmail(recipient.email);
    setResendError(null);
    setResendSuccess(null);
  }

  async function handleResend(recipientId: string) {
    if (!id) return;
    setResendingId(recipientId);
    setResendError(null);
    setResendSuccess(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/resend-recipient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, email: resendEmail.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to resend email.");
      setResendSuccess(`Sent to ${(data as { sentTo?: string }).sentTo ?? resendEmail}`);
      setResendFormId(null);
      await reload();
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend email.");
    } finally {
      setResendingId(null);
    }
  }

  async function copySigningLink(token: string) {
    const url = `${window.location.origin}/sign/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleDelete() {
    if (!id) return;
    setDeleteBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to delete request.");
      router.push("/dashboard/signing");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete request.");
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  }

  async function handleDownload(type: "signed" | "cert" | "original") {
    if (!id) return;
    setDownloadBusy(type);
    setActionError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/download${type === "signed" ? "" : `?type=${type}`}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? data?.error ?? "Download failed.");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${request?.title?.trim() || request?.originalName || "document"}_${type}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadBusy(null);
    }
  }

  async function handleExtend(days: number) {
    if (!id) return;
    setExtendBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to extend deadline.");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to extend deadline.");
    } finally {
      setExtendBusy(false);
    }
  }

  async function handleSaveTemplate() {
    if (!id) return;
    setSaveTemplateBusy(true);
    try {
      const res = await fetch("/api/signing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to save template.");
      setSaveTemplateSuccess(true);
      setTimeout(() => setSaveTemplateSuccess(false), 3000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setSaveTemplateBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/dashboard/signing">
            <ArrowLeft className="w-4 h-4" />
            Back to Signing
          </Link>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Signing request not found."}
        </div>
      </div>
    );
  }

  const fieldCountsByRecipient = request.recipients.map((recipient) => ({
    recipient,
    count: request.signingFields.filter((field) => field.recipientId === recipient.id).length,
  }));

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "OVERVIEW", label: "Overview" },
    { id: "RECIPIENTS", label: "Recipients" },
    { id: "FIELDS", label: "Fields" },
    { id: "TIMELINE", label: "Timeline" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link href="/dashboard/signing">
              <ArrowLeft className="w-4 h-4" />
              Back to Signing
            </Link>
          </Button>
          <h1 className="ui-page-title mt-2">{request.title?.trim() || request.originalName || "Untitled request"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {request.originalName || "No file name"} · {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"} flow
          </p>
        </div>
        <div className="rounded-xl border border-border bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-3 w-full max-w-[360px] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            {statusPill ? <Badge className={statusPill.className}>{statusPill.label}</Badge> : <span />}
            <p className="text-[11px] text-muted-foreground">Created {new Date(request.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditable && (
              <Button variant="outline" size="sm" asChild className="h-8 gap-1.5">
                <Link href={`/dashboard/signing/${id}/edit-fields`}>
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRemind} disabled={!canRemind || remindBusy} className="h-8 gap-1.5">
              {remindBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
              Remind
            </Button>
            {canSaveTemplate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSaveTemplate()}
                disabled={saveTemplateBusy}
                className="h-8 gap-1.5"
              >
                {saveTemplateBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutTemplate className="w-3.5 h-3.5" />}
                {saveTemplateSuccess ? "Saved!" : "Save as Template"}
              </Button>
            )}
            {isExpiringSoon && (
              <div className="relative">
                <details className="group">
                  <summary className="list-none cursor-pointer">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50" disabled={extendBusy} asChild>
                      <span>
                        {extendBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                        Extend Deadline
                      </span>
                    </Button>
                  </summary>
                  <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 w-44">
                    {[3, 7, 14, 30].map((days) => (
                      <button
                        key={days}
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        onClick={() => { void handleExtend(days); (document.querySelector("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }}
                      >
                        + {days} days
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => void handleDownload("signed")} disabled={downloadBusy !== null} className="h-8 gap-1.5">
              {downloadBusy === "signed" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </Button>
            <Button variant="destructive" size="sm" onClick={handleVoid} disabled={!canVoid || voidBusy} className="h-8 gap-1.5">
              {voidBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              Void
            </Button>
          </div>
          {canDelete && (
            <div className="pt-1">
              {!confirmDelete ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete request
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteBusy} className="h-7 text-xs">
                    {deleteBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm delete"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 text-xs">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OverviewKpi label="Recipients" value={request.recipients.length} tone="blue" />
        <OverviewKpi label="Signed" value={`${completedRecipients}/${request.recipients.length}`} tone="emerald" />
        <OverviewKpi label="Fields" value={request.signingFields.length} tone="violet" />
        <OverviewKpi label="Expires" value={new Date(request.expiresAt).toLocaleDateString()} tone="amber" />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-50/90 via-white to-blue-50/30 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary/12 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "OVERVIEW" && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
          <section className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/60 to-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Recipient Progress</h2>
            <div className="space-y-2">
              {fieldCountsByRecipient.map(({ recipient, count }) => {
                const badge = recipientStatusBadge(recipient.status);
                return (
                  <div key={recipient.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground">{recipient.email}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{count} field{count === 1 ? "" : "s"}</p>
                    </div>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/50 to-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Links</h2>
            {(status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") ? (
              <div className="space-y-2">
                {request.recipients.map((recipient) => {
                  const signUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/sign/${recipient.token}`;
                  const isCopied = copiedToken === recipient.token;
                  return (
                    <div key={recipient.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{recipient.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{signUrl}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void copySigningLink(recipient.token)}>
                        {isCopied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Links are shown while request is active.</p>
            )}
          </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/70 to-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Files & Downloads</h2>
            {request.blobUrl ? (
              <a
                href={`/dashboard/signing/${id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border p-4 hover:bg-muted/40 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Open Live Document Preview</span>
                </div>
                <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No document preview available.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleDownload("signed")} disabled={downloadBusy !== null} className="gap-2">
                {downloadBusy === "signed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {request.signedBlobUrl ? "Download Signed PDF" : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={() => handleDownload("cert")} disabled={downloadBusy !== null || !request.certificate?.blobUrl} className="gap-2">
                {downloadBusy === "cert" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                Download Certificate
              </Button>
              <Button variant="outline" onClick={() => handleDownload("original")} disabled={downloadBusy !== null} className="gap-2">
                {downloadBusy === "original" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download Original
              </Button>
              {status === "COMPLETED" && (
                <Button variant="outline" asChild className="gap-2">
                  <a href={`/envelope/${id}`} target="_blank" rel="noopener noreferrer">
                    <ShieldAlert className="w-4 h-4" />
                    Verify Envelope
                  </a>
                </Button>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "RECIPIENTS" && (
        <section className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/50 to-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Recipients</h2>
          {resendSuccess ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resendSuccess}</div> : null}
          {resendError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resendError}</div> : null}

          <SigningOrderFlow
            signingMode={request.signingMode}
            recipients={request.recipients.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              order: r.order,
              status: r.status,
              completedAt: r.completedAt,
              isAgent: r.isAgent,
            }))}
          />

          <div className="space-y-2">
            {fieldCountsByRecipient.map(({ recipient, count }) => {
              const badge = recipientStatusBadge(recipient.status);
              const canResend = recipient.status === "PENDING" || recipient.status === "OPENED";
              const canReassign = (status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") && (recipient.status === "PENDING" || recipient.status === "OPENED");
              const isShowingForm = resendFormId === recipient.id;
              return (
                <div key={recipient.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground">{recipient.email}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{request.signingMode === "SEQUENTIAL" ? `Signer ${recipient.order + 1}` : "Parallel"} · {count} field{count === 1 ? "" : "s"}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {recipient.completedAt ? <p className="text-[11px] text-muted-foreground mt-1">{new Date(recipient.completedAt).toLocaleString()}</p> : null}
                      {canResend && !isShowingForm ? (
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <button type="button" onClick={() => openResendForm(recipient)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Resend
                          </button>
                          {canReassign && (
                            <button
                              type="button"
                              onClick={() => setReassignTarget(recipient)}
                              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-2"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {isShowingForm ? (
                    <div className="border-t border-border pt-2 space-y-2">
                      <Input
                        type="email"
                        value={resendEmail}
                        onChange={(event) => setResendEmail(event.target.value)}
                        placeholder="recipient@email.com"
                        className="h-8 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-7 text-xs gap-1.5" disabled={resendingId === recipient.id || !resendEmail.trim()} onClick={() => void handleResend(recipient.id)}>
                          {resendingId === recipient.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setResendFormId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {reassignTarget && (
            <ReassignModal
              requestId={id}
              recipient={reassignTarget}
              onClose={() => setReassignTarget(null)}
              onSuccess={async () => { setReassignTarget(null); await reload(); }}
            />
          )}
        </section>
      )}

      {activeTab === "FIELDS" && (
        <section className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/45 to-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Field Layout</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Page</th>
                  <th className="py-2 pr-3">Position</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2">Required</th>
                </tr>
              </thead>
              <tbody>
                {request.signingFields.map((field) => {
                  const recipient = request.recipients.find((r) => r.id === field.recipientId);
                  return (
                    <tr key={field.id} className="border-b border-border/70">
                      <td className="py-2 pr-3 font-medium text-foreground">{field.type}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{recipient?.name ?? "Unknown"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{field.page}</td>
                      <td className="py-2 pr-3 text-muted-foreground">x:{field.x.toFixed(2)} y:{field.y.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">w:{field.width.toFixed(2)} h:{field.height.toFixed(2)}</td>
                      <td className="py-2 text-muted-foreground">{field.required ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "TIMELINE" && (
        <section className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/50 to-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Audit Timeline</h2>
          {request.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {request.auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className="pt-1">
                    {log.event === "COMPLETED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : log.event === "DECLINED" ? (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    ) : log.event === "SENT" ? (
                      <Send className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{eventLabel(log.event)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push("/dashboard/signing")}>Back to List</Button>
      </div>
    </div>
  );
}

function ReassignModal({
  requestId,
  recipient,
  onClose,
  onSuccess,
}: {
  requestId: string;
  recipient: Recipient;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(recipient.name);
  const [email, setEmail] = useState(recipient.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signing/requests/${requestId}/recipients/${recipient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to reassign recipient.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reassign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-sm text-foreground">Reassign Recipient</h3>
          <p className="text-xs text-muted-foreground mt-0.5">The original signing link will be invalidated. A new invitation will be sent to the new email.</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Full Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" placeholder="Full name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-9 text-sm" placeholder="email@example.com" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className="flex-1" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Reassign &amp; Resend
          </Button>
        </div>
      </div>
    </div>
  );
}

function OverviewKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "emerald" | "violet" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50/70"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50/70"
        : tone === "violet"
          ? "border-violet-200 bg-violet-50/70"
          : "border-amber-200 bg-amber-50/70";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}
