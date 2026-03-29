"use client";

import { useEffect, useMemo, useState } from "react";
import { SigningLiveViewer, type LiveField } from "@/components/signing-live-viewer";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Loader2,
  Mail,
  Send,
  ShieldAlert,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RequestStatus = "DRAFT" | "SENT" | "OPENED" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type RecipientStatus = "PENDING" | "OPENED" | "COMPLETED" | "DECLINED";

interface Recipient {
  id: string;
  name: string;
  email: string;
  order: number;
  status: RecipientStatus;
  completedAt: string | null;
  token: string;
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
  voidedAt: string | null;
  createdAt: string;
  blobUrl: string | null;
  signedBlobUrl: string | null;
  recipients: Recipient[];
  signingFields: SigningField[];
  pages: PageDim[];
  auditLogs: AuditLog[];
  certificate?: { blobUrl: string } | null;
}

function resolveDisplayStatus(request: SigningRequestDetail): RequestStatus {
  if (request.displayStatus) return request.displayStatus;
  const completedCount = request.recipients.filter((recipient) => recipient.status === "COMPLETED").length;
  if (
    (request.status === "SENT" || request.status === "OPENED") &&
    completedCount > 0 &&
    completedCount < request.recipients.length
  ) {
    return "PARTIALLY_SIGNED";
  }
  return request.status;
}

function requestBadge(status: RequestStatus) {
  if (status === "DRAFT") return { label: "Draft", className: "bg-muted text-muted-foreground" };
  if (status === "PARTIALLY_SIGNED") return { label: "Partially Signed", className: "bg-violet-500/10 text-violet-700" };
  if (status === "SENT" || status === "OPENED") return { label: "Sent", className: "bg-blue-500/10 text-blue-700" };
  if (status === "COMPLETED") return { label: "Completed", className: "bg-emerald-500/10 text-emerald-700" };
  if (status === "VOIDED") return { label: "Voided", className: "bg-orange-500/10 text-orange-700" };
  return { label: "Expired", className: "bg-red-500/10 text-red-700" };
}

function recipientStatusBadge(status: RecipientStatus) {
  if (status === "COMPLETED") return { label: "Signed", className: "bg-emerald-500/10 text-emerald-700" };
  if (status === "OPENED") return { label: "Opened", className: "bg-blue-500/10 text-blue-700" };
  if (status === "DECLINED") return { label: "Declined", className: "bg-red-500/10 text-red-700" };
  return { label: "Waiting", className: "bg-muted text-muted-foreground" };
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
  const [voidBusy, setVoidBusy] = useState(false);
  const [remindBusy, setRemindBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<null | "signed" | "cert" | "original">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFormId, setResendFormId] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

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
  const statusBadge = status ? requestBadge(status) : null;
  const completedRecipients = request?.recipients.filter((recipient) => recipient.status === "COMPLETED").length ?? 0;
  const canRemind = status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED";
  const canVoid = status !== "COMPLETED" && status !== "VOIDED" && status !== "EXPIRED";
  const isEditable = (request as unknown as { isEditable?: boolean })?.isEditable ?? status === "DRAFT";
  const canDelete = status === "DRAFT" || status === "VOIDED" || status === "EXPIRED";

  // Build live field overlays for the document viewer
  const liveFields = useMemo<LiveField[]>(() => {
    if (!request) return [];
    const recipientMap = new Map(
      request.recipients.map((r, i) => [r.id, { name: r.name, index: i }])
    );
    return request.signingFields.map((f) => {
      const rec = recipientMap.get(f.recipientId);
      return {
        id: f.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value ?? null,
        recipientName: rec?.name ?? "Unknown",
        recipientIndex: rec?.index ?? 0,
      };
    });
  }, [request]);

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
      const res = await fetch(
        `/api/signing/requests/${encodeURIComponent(id)}/download${type === "signed" ? "" : `?type=${type}`}`
      );
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link href="/dashboard/signing">
              <ArrowLeft className="w-4 h-4" />
              Back to Signing
            </Link>
          </Button>
          <h1 className="ui-page-title mt-2">{request.title?.trim() || request.originalName || "Untitled request"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {request.originalName || "No document name"} · {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"} flow
          </p>
        </div>
        {statusBadge ? <Badge className={statusBadge.className}>{statusBadge.label}</Badge> : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Recipients</p>
          <p className="text-lg font-semibold text-foreground">{request.recipients.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="text-lg font-semibold text-foreground">
            {completedRecipients}/{request.recipients.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Fields</p>
          <p className="text-lg font-semibold text-foreground">{request.signingFields.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Expires</p>
          <p className="text-sm font-medium text-foreground">{new Date(request.expiresAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {isEditable && (
            <Button variant="outline" asChild className="gap-2">
              <Link href={`/dashboard/signing/${id}/edit-fields`}>
                <Edit2 className="w-4 h-4" />
                Edit Fields
              </Link>
            </Button>
          )}
          <Button
            onClick={() => handleDownload("signed")}
            disabled={downloadBusy !== null || !request.signedBlobUrl}
            title={!request.signedBlobUrl ? "Available when all parties have signed" : undefined}
            className="gap-2"
          >
            {downloadBusy === "signed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Signed PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("cert")}
            disabled={downloadBusy !== null || !request.certificate?.blobUrl}
            title={!request.certificate?.blobUrl ? "Available when all parties have signed" : undefined}
            className="gap-2"
          >
            {downloadBusy === "cert" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Download Certificate
          </Button>
          <Button variant="outline" onClick={() => handleDownload("original")} disabled={downloadBusy !== null} className="gap-2">
            {downloadBusy === "original" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Original
          </Button>
          <Button variant="outline" onClick={handleRemind} disabled={!canRemind || remindBusy} className="gap-2">
            {remindBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
            Send Reminder
          </Button>
          <Button variant="destructive" onClick={handleVoid} disabled={!canVoid || voidBusy} className="gap-2">
            {voidBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Void Request
          </Button>
          {canDelete && !confirmDelete && (
            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive">Delete this request?</span>
              <Button variant="destructive" size="sm" disabled={deleteBusy} onClick={handleDelete} className="gap-1.5">
                {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
        {actionError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
        ) : null}
      </div>

      {/* ── Document Viewer ──────────────────────────────────────────── */}
      {request.blobUrl && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setDocPreviewOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {request.signedBlobUrl ? "View Signed Document" : "Live Document View"}
              </span>
              {request.signedBlobUrl ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                  Completed
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">
                  Live
                </span>
              )}
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-muted-foreground transition-transform ${docPreviewOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {docPreviewOpen && (
            <div className="border-t border-border">
              {/* Signed: show final PDF via iframe; In-progress: live viewer with overlays */}
              {request.signedBlobUrl ? (
                <iframe
                  src={`/api/signing/requests/${encodeURIComponent(id)}/download`}
                  className="w-full"
                  style={{ height: "70vh", minHeight: "500px" }}
                  title="Signed document"
                />
              ) : (
                <SigningLiveViewer blobUrl={request.blobUrl} fields={liveFields} />
              )}
              {/* Export/download row */}
              <div className="flex flex-wrap gap-2 p-3 border-t border-border bg-muted/30">
                {request.signedBlobUrl && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload("signed")} disabled={downloadBusy !== null} className="gap-1.5">
                    {downloadBusy === "signed" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download Signed PDF
                  </Button>
                )}
                {request.certificate?.blobUrl && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload("cert")} disabled={downloadBusy !== null} className="gap-1.5">
                    {downloadBusy === "cert" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    Download Certificate
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDownload("original")} disabled={downloadBusy !== null} className="gap-1.5 text-muted-foreground">
                  {downloadBusy === "original" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download Original
                </Button>
                {!request.signedBlobUrl && (
                  <span className="text-xs text-muted-foreground self-center ml-1">
                    Signed PDF &amp; Certificate available once all parties complete
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4" />
            Signing Links
          </h2>
          <p className="text-xs text-muted-foreground">Share these links directly with each recipient if they didn&apos;t receive the email.</p>
          <div className="space-y-2">
            {request.recipients.map((recipient) => {
              const signUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/sign/${recipient.token}`;
              const isCopied = copiedToken === recipient.token;
              return (
                <div key={recipient.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{recipient.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{signUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copySigningLink(recipient.token)}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    {isCopied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Recipient Status
          </h2>
          {resendSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {resendSuccess}
            </div>
          )}
          {resendError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {resendError}
            </div>
          )}
          <div className="space-y-2">
            {fieldCountsByRecipient.map(({ recipient, count }) => {
              const badge = recipientStatusBadge(recipient.status);
              const canResend = recipient.status === "PENDING" || recipient.status === "OPENED";
              const isShowingForm = resendFormId === recipient.id;
              return (
                <div key={recipient.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.signingMode === "SEQUENTIAL" ? `Signer ${recipient.order + 1}` : "Parallel"} · {count} field{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1.5">
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {recipient.completedAt ? (
                        <p className="text-[11px] text-muted-foreground">{new Date(recipient.completedAt).toLocaleString()}</p>
                      ) : null}
                      {canResend && !isShowingForm && (
                        <button
                          type="button"
                          onClick={() => openResendForm(recipient)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Mail className="w-3 h-3" />
                          Resend Email
                        </button>
                      )}
                    </div>
                  </div>
                  {isShowingForm && (
                    <div className="border-t border-border pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">Send to (edit to use a different address):</p>
                      <Input
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="recipient@email.com"
                        className="h-8 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          disabled={resendingId === recipient.id || !resendEmail.trim()}
                          onClick={() => void handleResend(recipient.id)}
                        >
                          {resendingId === recipient.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Send
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setResendFormId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Activity Timeline
          </h2>
          {request.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {request.auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="pt-1">
                    {log.event === "COMPLETED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : log.event === "DECLINED" ? (
                      <XCircle className="w-4 h-4 text-red-600" />
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
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push("/dashboard/signing")}>
          Back to List
        </Button>
      </div>
    </div>
  );
}
