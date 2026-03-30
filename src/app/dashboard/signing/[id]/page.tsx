"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart3,
  ArrowLeft,
  Ban,
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  LayoutTemplate,
  Link2,
  Loader2,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { SigningOrderFlow } from "@/components/signing/signing-order-flow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DECLINE_REASON_LABELS,
  isDeclineReasonCode,
} from "@/lib/signing/decline-reasons";
import { toast } from "@/lib/toast";

type RequestStatus = "DRAFT" | "SENT" | "OPENED" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type RecipientStatus = "PENDING" | "OPENED" | "COMPLETED" | "DECLINED";
type DetailTab = "OVERVIEW" | "RECIPIENTS" | "FIELDS" | "TIMELINE" | "ANALYTICS" | "PUBLIC_LINKS";

interface Recipient {
  id: string;
  name: string;
  email: string;
  order: number;
  status: RecipientStatus;
  openedAt?: string | null;
  completedAt: string | null;
  token: string;
  isAgent?: boolean;
  isPublicSlot?: boolean;
  phone?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  declineReasonCode?: string | null;
  declineReasonText?: string | null;
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

interface PublicLink {
  id: string;
  token: string;
  label: string | null;
  maxUses: number | null;
  usedCount: number;
  requireName: boolean;
  requireEmail: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  usages: Array<{
    id: string;
    createdAt: string;
    recipient: { name: string; email: string; status: string; completedAt: string | null };
  }>;
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
  readingAnalytics?: {
    pages: number[];
    recipients: Array<{
      recipientId: string;
      recipientName: string;
      recipientEmail: string;
      status: string | null;
      completedAt: string | null;
      pagesTotal: number;
      pagesViewed: number;
      pagesCompleted: number;
      totalDwellMs: number;
      readCompletenessPct: number;
      unreadPages: number[];
      signedWithUnreadPages: boolean;
      pages: Array<{
        page: number;
        totalDwellMs: number;
        maxScrollPct: number;
        viewCount: number;
        completed: boolean;
      }>;
    }>;
    summary: {
      totalDwellMs: number;
      avgReadCompletenessPct: number;
      signedWithUnreadCount: number;
      recipientCount: number;
    };
  };
}

function resolveDisplayStatus(request: SigningRequestDetail): RequestStatus {
  if (request.displayStatus) return request.displayStatus;
  const completedCount = request.recipients.filter((r) => r.status === "COMPLETED").length;
  if ((request.status === "SENT" || request.status === "OPENED") && completedCount > 0 && completedCount < request.recipients.length) {
    return "PARTIALLY_SIGNED";
  }
  return request.status;
}

function statusDot(status: RequestStatus): { color: string; label: string } {
  if (status === "COMPLETED") return { color: "#16a34a", label: "Completed" };
  if (status === "PARTIALLY_SIGNED") return { color: "#d97706", label: "Partially Signed" };
  if (status === "SENT" || status === "OPENED") return { color: "#2563eb", label: "Sent" };
  if (status === "VOIDED") return { color: "#ea580c", label: "Voided" };
  if (status === "EXPIRED") return { color: "#e11d48", label: "Expired" };
  return { color: "#94a3b8", label: "Draft" };
}

function recipientDot(status: RecipientStatus): { color: string; label: string } {
  if (status === "COMPLETED") return { color: "#16a34a", label: "Signed" };
  if (status === "OPENED") return { color: "#2563eb", label: "Opened" };
  if (status === "DECLINED") return { color: "#e11d48", label: "Declined" };
  return { color: "#94a3b8", label: "Waiting" };
}

function recipientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
    PUBLIC_LINK_CREATED: "Public signing link created",
    PUBLIC_LINK_USED: "Someone signed via public link",
    READING_ANALYTICS_SNAPSHOT: "Reading analytics snapshot saved",
  };
  return map[event] ?? event;
}

function timelineEventColor(event: string): string {
  if (event === "COMPLETED") return "#16a34a";
  if (event === "DECLINED" || event === "VOIDED") return "#e11d48";
  if (event === "SENT" || event === "REMINDER_SENT" || event === "EXPIRY_REMINDER_SENT") return "#2563eb";
  if (event === "RECIPIENT_SIGNED") return "#7c3aed";
  return "#94a3b8";
}

function parseAuditMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function declineReasonLabel(code: string | null | undefined): string | null {
  if (!code || !isDeclineReasonCode(code)) return null;
  return DECLINE_REASON_LABELS[code];
}

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function sessionDurationMs(openedAt?: string | null, completedAt?: string | null): number | null {
  if (!openedAt || !completedAt) return null;
  const opened = new Date(openedAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (!Number.isFinite(opened) || !Number.isFinite(completed) || completed < opened) return null;
  return completed - opened;
}

export default function SigningRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<SigningRequestDetail | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("OVERVIEW");

  const [voidBusy, setVoidBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [remindBusy, setRemindBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<null | "signed" | "cert" | "original">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFormId, setResendFormId] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<string>("");
  const [extendBusy, setExtendBusy] = useState(false);
  const [showExtendMenu, setShowExtendMenu] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Recipient | null>(null);
  const [saveTemplateBusy, setSaveTemplateBusy] = useState(false);
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState(false);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState<Date | null>(null);

  // Public links
  const [publicLinks, setPublicLinks] = useState<PublicLink[]>([]);
  const [publicLinksLoading, setPublicLinksLoading] = useState(false);
  const [showCreatePublicLink, setShowCreatePublicLink] = useState(false);
  const [copiedPublicToken, setCopiedPublicToken] = useState<string | null>(null);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [confirmDeleteLinkId, setConfirmDeleteLinkId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      // error cleared;
      try {
        const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to load signing request.");
        const detail = (data?.request ?? data) as SigningRequestDetail;
        if (!cancelled) {
          setRequest(detail);
          setAnalyticsUpdatedAt(new Date());
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load signing request.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    void loadPublicLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const status = useMemo(() => (request ? resolveDisplayStatus(request) : null), [request]);
  const dot = status ? statusDot(status) : null;
  const completedRecipients = request?.recipients.filter((r) => r.status === "COMPLETED").length ?? 0;
  const canSendDraft = status === "DRAFT";
  const canRemind = status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED";
  const canManagePublicLinks = status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED";
  const canVoid = status !== "COMPLETED" && status !== "VOIDED" && status !== "EXPIRED";
  const isEditable = request?.isEditable ?? status === "DRAFT";
  const canDelete = !!status;
  const isExpiringSoon = request && (status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") && new Date(request.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && new Date(request.expiresAt).getTime() > Date.now();
  const canSaveTemplate = status === "SENT" || status === "COMPLETED";
  const analyticsLiveTracking = status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED";
  const recipientSessionRows = useMemo(
    () =>
      (request?.recipients ?? []).map((recipient) => {
        const durationMs = sessionDurationMs(recipient.openedAt, recipient.completedAt);
        return {
          recipient,
          durationMs,
          inProgressMs:
            recipient.status === "OPENED" && recipient.openedAt
              ? Math.max(0, Date.now() - new Date(recipient.openedAt).getTime())
              : null,
        };
      }),
    [request?.recipients]
  );
  const completedSessionCount = recipientSessionRows.filter((row) => row.durationMs != null).length;
  const totalSessionMs = recipientSessionRows.reduce((sum, row) => sum + (row.durationMs ?? 0), 0);
  const avgSessionMs = completedSessionCount > 0 ? Math.round(totalSessionMs / completedSessionCount) : 0;

  const reload = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to reload.");
    setRequest((data?.request ?? data) as SigningRequestDetail);
    setAnalyticsUpdatedAt(new Date());
  }, [id]);

  useEffect(() => {
    if (activeTab !== "ANALYTICS") return;
    if (!analyticsLiveTracking) return;
    const timer = window.setInterval(() => {
      void reload().catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeTab, analyticsLiveTracking, reload]);

  async function refreshAnalytics() {
    setAnalyticsRefreshing(true);
    try {
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh analytics.");
    } finally {
      setAnalyticsRefreshing(false);
    }
  }

  async function loadPublicLinks() {
    if (!id) return;
    setPublicLinksLoading(true);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/public-links`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPublicLinks((data as { links: PublicLink[] }).links ?? []);
    } finally {
      setPublicLinksLoading(false);
    }
  }

  async function togglePublicLink(linkId: string, isActive: boolean) {
    setTogglingLinkId(linkId);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/public-links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) setPublicLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, isActive } : l));
    } finally {
      setTogglingLinkId(null);
    }
  }

  async function deletePublicLink(linkId: string) {
    setDeletingLinkId(linkId);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/public-links/${linkId}`, { method: "DELETE" });
      if (res.ok) {
        setPublicLinks((prev) => prev.filter((l) => l.id !== linkId));
        setConfirmDeleteLinkId(null);
      }
    } finally {
      setDeletingLinkId(null);
    }
  }

  async function copyPublicLink(token: string) {
    const url = `${window.location.origin}/sign/public/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopiedPublicToken(token);
    setTimeout(() => setCopiedPublicToken(null), 2000);
  }

  async function handleSendNow() {
    if (!id) return;
    setSendBusy(true);
    // action error cleared;
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/send`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to send request.");
      await reload();
      toast.success("Agreement sent. Recipients have been notified.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setSendBusy(false);
    }
  }

  async function handleRemind() {
    if (!id) return;
    setRemindBusy(true);
    // action error cleared;
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/remind`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to send reminders.");
      await reload();
      const remindedCount = Number((data as { reminded?: number }).reminded ?? 0);
      toast.success(
        remindedCount > 0
          ? `Resent to ${remindedCount} pending recipient${remindedCount === 1 ? "" : "s"}.`
          : "No pending recipients to resend."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminders.");
    } finally {
      setRemindBusy(false);
    }
  }

  async function handleVoid() {
    if (!id) return;
    setVoidBusy(true);
    // action error cleared;
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/void`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to void request.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void request.");
    } finally {
      setVoidBusy(false);
    }
  }

  function openResendForm(recipient: { id: string; email: string }) {
    setResendFormId(recipient.id);
    setResendEmail(recipient.email);
  }

  async function handleResend(recipientId: string) {
    if (!id) return;
    setResendingId(recipientId);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/resend-recipient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, email: resendEmail.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to resend email.");
      toast.success(`Sent to ${(data as { sentTo?: string }).sentTo ?? resendEmail}`);
      setResendFormId(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend email.");
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
    // action error cleared;
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to delete request.");
      router.push("/dashboard/signing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete request.");
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  }

  async function handleDownload(type: "signed" | "cert" | "original") {
    if (!id) return;
    setDownloadBusy(type);
    // action error cleared;
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
      toast.error(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadBusy(null);
    }
  }

  async function handleExtend(days: number) {
    if (!id) return;
    setExtendBusy(true);
    setShowExtendMenu(false);
    // action error cleared;
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
      toast.error(err instanceof Error ? err.message : "Failed to extend deadline.");
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
      toast.error(err instanceof Error ? err.message : "Failed to save template.");
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

  if (!request) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/dashboard/signing">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Link>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Signing request not found.
        </div>
      </div>
    );
  }

  const fieldCountsByRecipient = request.recipients.map((recipient) => ({
    recipient,
    count: request.signingFields.filter((f) => f.recipientId === recipient.id).length,
  }));

  const completionPercent = request.recipients.length > 0
    ? Math.round((completedRecipients / request.recipients.length) * 100)
    : 0;

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "OVERVIEW", label: "Overview" },
    { id: "RECIPIENTS", label: "Recipients" },
    { id: "FIELDS", label: "Fields" },
    { id: "TIMELINE", label: "Timeline" },
    { id: "ANALYTICS", label: "Analytics" },
    { id: "PUBLIC_LINKS", label: "Public Links" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Back nav */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground w-fit">
        <Link href="/dashboard/signing">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Agreements
        </Link>
      </Button>

      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="ui-page-title">{request.title?.trim() || request.originalName || "Untitled request"}</h1>
            {dot && (
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot.color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: dot.color }}>{dot.label}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {request.originalName || "No file name"}
            {" · "}
            {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"} flow
            {" · "}
            Created {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isEditable && (
            <Button variant="outline" size="sm" asChild className="h-9 gap-1.5">
              <Link href={`/dashboard/signing/${id}/edit-fields`}>
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </Link>
            </Button>
          )}
          {canSendDraft ? (
            <Button variant="default" size="sm" onClick={() => void handleSendNow()} disabled={sendBusy} className="h-9 gap-1.5">
              {sendBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Now
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRemind} disabled={!canRemind || remindBusy} className="h-9 gap-1.5">
              {remindBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
              Resend Pending
            </Button>
          )}
          {canSaveTemplate && (
            <Button variant="outline" size="sm" onClick={() => void handleSaveTemplate()} disabled={saveTemplateBusy} className="h-9 gap-1.5">
              {saveTemplateBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutTemplate className="w-3.5 h-3.5" />}
              {saveTemplateSuccess ? "Saved!" : "Save Template"}
            </Button>
          )}
          {isExpiringSoon && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                disabled={extendBusy}
                onClick={() => setShowExtendMenu((v) => !v)}
              >
                {extendBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                Extend
              </Button>
              {showExtendMenu && (
                <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 w-40">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      onClick={() => void handleExtend(days)}
                    >
                      +{days} days
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => void handleDownload("signed")} disabled={downloadBusy !== null} className="h-9 gap-1.5">
            {downloadBusy === "signed" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleVoid} disabled={!canVoid || voidBusy} className="h-9 gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50">
            {voidBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
            Void
          </Button>
          {canDelete && !confirmDelete && (
            <Button variant="ghost" size="sm" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-1.5">
              <Button variant="destructive" size="sm" className="h-9 text-xs" onClick={() => void handleDelete()} disabled={deleteBusy}>
                {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm delete"}
              </Button>
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>

      {/* Floating metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-2xl overflow-hidden">
        {[
          { label: "RECIPIENTS", value: request.recipients.length },
          { label: "SIGNED", value: `${completedRecipients}/${request.recipients.length}` },
          { label: "FIELDS", value: request.signingFields.length },
          { label: "EXPIRES", value: new Date(request.expiresAt).toLocaleDateString() },
        ].map((m, i) => (
          <div
            key={m.label}
            className="px-5 py-4 flex flex-col gap-1"
            style={{ borderLeft: i > 0 ? "1px solid hsl(var(--border))" : undefined }}
          >
            <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>
              {m.label}
            </span>
            <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: "hsl(var(--foreground))" }}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-[3px] rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${completionPercent}%`, background: dot?.color ?? "#94a3b8" }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{completionPercent}% complete — {completedRecipients} of {request.recipients.length} signed</p>
      </div>

      {/* Pill tabs */}
      <div className="bg-muted rounded-xl p-1 flex items-center gap-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">

            {/* Recipient progress */}
            <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recipient Progress</h2>
              <div className="space-y-2">
                {fieldCountsByRecipient.map(({ recipient, count }) => {
                  const rdot = recipientDot(recipient.status);
                  const declineLabel = declineReasonLabel(recipient.declineReasonCode);
                  const declineText = recipient.declineReasonText ?? recipient.declineReason ?? null;
                  return (
                    <div key={recipient.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: rdot.color, flexShrink: 0,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: "11px", fontWeight: 700, color: "#fff",
                          }}
                        >
                          {recipientInitials(recipient.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{recipient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                        {recipient.status === "DECLINED" && (
                          <p className="text-[11px] text-rose-700 mt-0.5 truncate">
                            {declineLabel ? `Reason: ${declineLabel}` : "Reason provided"}
                            {declineText ? ` · ${declineText}` : ""}
                          </p>
                        )}
                      </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1">
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: rdot.color, display: "inline-block" }} />
                          <span style={{ fontSize: "12px", fontWeight: 500, color: rdot.color }}>{rdot.label}</span>
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{count} field{count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Quick links */}
            <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Signing Links</h2>
              {(status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") ? (
                <div className="space-y-2">
                  {request.recipients.map((recipient) => {
                    const signUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/sign/${recipient.token}`;
                    const isCopied = copiedToken === recipient.token;
                    return (
                      <div key={recipient.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{signUrl}</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void copySigningLink(recipient.token)}>
                          {isCopied ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Links are shown while the request is active.</p>
              )}
            </section>
          </div>

          {/* Collected Files (ATTACHMENT fields) */}
          {request.signingFields.some((f) => f.type === "ATTACHMENT" && f.value) && (
            <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Collected Files</h2>
              </div>
              <div className="space-y-1">
                {request.signingFields
                  .filter((f) => f.type === "ATTACHMENT" && f.value)
                  .map((f) => {
                    const signer = request.recipients.find((r) => r.id === f.recipientId);
                    let meta: { url?: string; name?: string; size?: number; type?: string } = {};
                    try { meta = JSON.parse(f.value!) as typeof meta; } catch { /* base64 or plain URL */ }
                    // Support blob URL (JSON), direct URL string, or base64 data URI
                    const downloadUrl = meta.url || (f.value!.startsWith("https://") ? f.value! : null);
                    const isBase64 = !downloadUrl && f.value!.startsWith("data:");
                    const displayName = meta.name ?? "Attachment";
                    const fileSizeLabel = meta.size ? ` · ${meta.size > 1024 * 1024 ? `${(meta.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(meta.size / 1024)} KB`}` : "";
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground">{signer?.name ?? "Unknown signer"}{fileSizeLabel}</p>
                          </div>
                        </div>
                        {downloadUrl ? (
                          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={meta.name}>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0">
                              <Download className="w-3 h-3" />
                              Download
                            </Button>
                          </a>
                        ) : isBase64 ? (
                          <a href={f.value!} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0">
                              <Download className="w-3 h-3" />
                              View
                            </Button>
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground shrink-0">No download</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Files & downloads */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Files & Downloads</h2>
            {request.blobUrl && (
              <a
                href={`/dashboard/signing/${id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl border border-border hover:bg-muted/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Open document preview</span>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleDownload("signed")} disabled={downloadBusy !== null} className="gap-2 h-9">
                {downloadBusy === "signed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {request.signedBlobUrl ? "Signed PDF" : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={() => void handleDownload("cert")} disabled={downloadBusy !== null || !request.certificate?.blobUrl} className="gap-2 h-9">
                {downloadBusy === "cert" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Certificate
              </Button>
              <Button variant="outline" onClick={() => void handleDownload("original")} disabled={downloadBusy !== null} className="gap-2 h-9">
                {downloadBusy === "original" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Original
              </Button>
              {status === "COMPLETED" && (
                <Button variant="outline" asChild className="gap-2 h-9">
                  <a href={`/envelope/${id}`} target="_blank" rel="noopener noreferrer">
                    <ShieldCheck className="w-4 h-4" />
                    Verify Envelope
                  </a>
                </Button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── RECIPIENTS ── */}
      {activeTab === "RECIPIENTS" && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recipients</h2>
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

          <div className="space-y-2 pt-2">
            {fieldCountsByRecipient.map(({ recipient, count }) => {
              const rdot = recipientDot(recipient.status);
              const canResend = recipient.status === "PENDING" || recipient.status === "OPENED";
              const canReassign = (status === "SENT" || status === "OPENED" || status === "PARTIALLY_SIGNED") && (recipient.status === "PENDING" || recipient.status === "OPENED");
              const canSendThisRecipient =
                canResend &&
                (status !== "DRAFT" || request.signingMode !== "SEQUENTIAL" || recipient.order === 0);
              const isShowingForm = resendFormId === recipient.id;
              const declineLabel = declineReasonLabel(recipient.declineReasonCode);
              const declineText = recipient.declineReasonText ?? recipient.declineReason ?? null;

              return (
                <div key={recipient.id} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: rdot.color, flexShrink: 0,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", fontWeight: 700, color: "#fff",
                        }}
                      >
                        {recipientInitials(recipient.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{recipient.name}</p>
                          {recipient.isAgent && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5">
                              <UserCheck className="w-3 h-3" />
                              Agent
                            </span>
                          )}
                          {recipient.isPublicSlot && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5">
                              <Globe className="w-3 h-3" />
                              Public slot
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {request.signingMode === "SEQUENTIAL" ? `Signer ${recipient.order + 1}` : "Parallel"} · {count} field{count !== 1 ? "s" : ""}
                        </p>
                        {recipient.status === "DECLINED" && (
                          <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1">
                            <p className="text-[11px] font-medium text-rose-700">
                              {declineLabel ?? "Decline reason"}
                            </p>
                            {declineText ? (
                              <p className="text-[11px] text-rose-700/90 mt-0.5">{declineText}</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className="inline-flex items-center gap-1">
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: rdot.color, display: "inline-block" }} />
                        <span style={{ fontSize: "12px", fontWeight: 500, color: rdot.color }}>{rdot.label}</span>
                      </span>
                      {recipient.completedAt && (
                        <p className="text-[11px] text-muted-foreground">{new Date(recipient.completedAt).toLocaleString()}</p>
                      )}
                      {canSendThisRecipient && !isShowingForm && (
                        <div className="flex items-center gap-2 justify-end">
                          <button type="button" onClick={() => openResendForm(recipient)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {status === "DRAFT" ? "Send" : "Resend"}
                          </button>
                          {canReassign && (
                            <button type="button" onClick={() => setReassignTarget(recipient)} className="text-[11px] text-muted-foreground hover:text-foreground underline">
                              Reassign
                            </button>
                          )}
                        </div>
                      )}
                      {canResend && !canSendThisRecipient && status === "DRAFT" && request.signingMode === "SEQUENTIAL" && (
                        <p className="text-[11px] text-muted-foreground">Will send after signer {recipient.order} completes.</p>
                      )}
                    </div>
                  </div>

                  {isShowingForm && (
                    <div className="border-t border-border pt-3 space-y-2">
                      <Input
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="recipient@email.com"
                        className="h-9 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={resendingId === recipient.id || !resendEmail.trim()} onClick={() => void handleResend(recipient.id)}>
                          {resendingId === recipient.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setResendFormId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
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

      {/* ── FIELDS ── */}
      {activeTab === "FIELDS" && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Field Layout</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  {["Type", "Recipient", "Page", "Position", "Size", "Required"].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {request.signingFields.map((field) => {
                  const recipient = request.recipients.find((r) => r.id === field.recipientId);
                  return (
                    <tr key={field.id} style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
                      <td className="py-2.5 pr-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-[11px] font-semibold text-foreground">{field.type}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-sm text-foreground">{recipient?.name ?? "Unknown"}</td>
                      <td className="py-2.5 pr-4 text-sm text-muted-foreground">{field.page}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground font-mono">x:{field.x.toFixed(2)} y:{field.y.toFixed(2)}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground font-mono">w:{field.width.toFixed(2)} h:{field.height.toFixed(2)}</td>
                      <td className="py-2.5 text-sm text-muted-foreground">{field.required ? "Yes" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TIMELINE ── */}
      {activeTab === "TIMELINE" && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Audit Timeline</h2>
          {request.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-border" />

              <div className="space-y-5">
                {request.auditLogs.map((log) => {
                  const color = timelineEventColor(log.event);
                  const meta = parseAuditMetadata(log.metadata);
                  const metaReasonCodeRaw = typeof meta?.reasonCode === "string" ? meta.reasonCode : null;
                  const metaReasonTextRaw = typeof meta?.reasonText === "string"
                    ? meta.reasonText
                    : typeof meta?.reason === "string"
                    ? meta.reason
                    : null;
                  const metaReasonLabel = declineReasonLabel(metaReasonCodeRaw);
                  return (
                    <div key={log.id} className="relative flex items-start gap-4">
                      {/* Dot */}
                      <span
                        style={{
                          position: "absolute",
                          left: -22,
                          top: 3,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: color,
                          border: "2px solid hsl(var(--card))",
                          boxShadow: `0 0 0 2px ${color}33`,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{eventLabel(log.event)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                        {log.event === "DECLINED" && (metaReasonLabel || metaReasonTextRaw) && (
                          <p className="text-xs text-rose-700 mt-1">
                            {metaReasonLabel ? `Reason: ${metaReasonLabel}` : "Reason captured"}
                            {metaReasonTextRaw ? ` · ${metaReasonTextRaw}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── PUBLIC LINKS ── */}
      {activeTab === "PUBLIC_LINKS" && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Public Signing Links</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Anyone with the link can sign — no email required.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowCreatePublicLink(true)}
              disabled={!canManagePublicLinks}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Link
            </Button>
          </div>
          {!canManagePublicLinks && (
            <p className="text-xs text-muted-foreground">
              Send this agreement first, then create public signing links.
            </p>
          )}

          {publicLinksLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : publicLinks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <Globe className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs font-medium text-muted-foreground">No public links yet</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Great for open houses, walk-in clients, or when you don&apos;t know the signer&apos;s email.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {publicLinks.map((link) => {
                const url = typeof window !== "undefined" ? `${window.location.origin}/sign/public/${link.token}` : `/sign/public/${link.token}`;
                const isCopied = copiedPublicToken === link.token;
                const isConfirming = confirmDeleteLinkId === link.id;
                const usageLabel = link.maxUses != null
                  ? `${link.usedCount} / ${link.maxUses} uses`
                  : `${link.usedCount} use${link.usedCount !== 1 ? "s" : ""}`;

                return (
                  <div key={link.id} className={`rounded-xl border border-border p-3 space-y-2 ${!link.isActive ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{link.label ?? "Untitled link"}</p>
                          <span
                            style={{
                              fontSize: "10px", fontWeight: 600, letterSpacing: "0.05em",
                              color: link.isActive ? "#16a34a" : "#94a3b8",
                              background: link.isActive ? "#f0fdf4" : "#f1f5f9",
                              border: `1px solid ${link.isActive ? "#bbf7d0" : "#e2e8f0"}`,
                              borderRadius: 999, padding: "1px 8px",
                            }}
                          >
                            {link.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{url}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{usageLabel}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => void copyPublicLink(link.token)}>
                          <Copy className="w-3 h-3" />
                          {isCopied ? "Copied!" : "Copy"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={togglingLinkId === link.id}
                          onClick={() => void togglePublicLink(link.id, !link.isActive)}
                        >
                          {togglingLinkId === link.id ? <Loader2 className="w-3 h-3 animate-spin" /> : link.isActive ? "Pause" : "Resume"}
                        </Button>
                        {!isConfirming ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteLinkId(link.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={deletingLinkId === link.id} onClick={() => void deletePublicLink(link.id)}>
                              {deletingLinkId === link.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDeleteLinkId(null)}>Cancel</Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {link.usages.length > 0 && (
                      <div className="border-t border-border pt-2 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signers</p>
                        {link.usages.slice(0, 5).map((u) => {
                          const rdot = u.recipient.status === "COMPLETED" ? "#16a34a" : u.recipient.status === "DECLINED" ? "#e11d48" : "#94a3b8";
                          return (
                            <div key={u.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: rdot, flexShrink: 0, display: "inline-block" }} />
                                <p className="text-xs text-foreground truncate">{u.recipient.name || "Guest"}</p>
                                {u.recipient.email && <p className="text-[11px] text-muted-foreground truncate">{u.recipient.email}</p>}
                              </div>
                              <p className="text-[11px] text-muted-foreground shrink-0">{new Date(u.createdAt).toLocaleDateString()}</p>
                            </div>
                          );
                        })}
                        {link.usages.length > 5 && (
                          <p className="text-[11px] text-muted-foreground">+{link.usages.length - 5} more</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── ANALYTICS ── */}
      {activeTab === "ANALYTICS" && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Signing Analytics
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Simple session tracking: time from opening the document to submitting signatures.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void refreshAnalytics()}
                disabled={analyticsRefreshing}
              >
                {analyticsRefreshing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                Refresh
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {analyticsUpdatedAt ? `Updated ${analyticsUpdatedAt.toLocaleTimeString()}` : "Not refreshed yet"}
                {analyticsLiveTracking ? " • live polling every 15s" : ""}
              </p>
            </div>
          </div>

          {recipientSessionRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5">
              <p className="text-sm font-medium text-foreground">No recipient session data yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Data appears after recipients open the signing document.
              </p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Completed Sessions</p>
                  <p className="text-sm font-semibold text-emerald-800 mt-0.5">{completedSessionCount}</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Session Time</p>
                  <p className="text-sm font-semibold text-sky-800 mt-0.5">{fmtDuration(totalSessionMs)}</p>
                </div>
                <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Session Time</p>
                  <p className="text-sm font-semibold text-violet-800 mt-0.5">{fmtDuration(avgSessionMs)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-x-auto bg-card/70">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground">Recipient</th>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground">Opened</th>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground">Submitted</th>
                      <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground">Session Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipientSessionRows.map(({ recipient, durationMs, inProgressMs }) => {
                      const rdot = recipientDot(recipient.status);
                      return (
                        <tr key={`summary-${recipient.id}`} style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-foreground">{recipient.name}</p>
                            <p className="text-xs text-muted-foreground">{recipient.email}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: rdot.color, display: "inline-block" }} />
                              {rdot.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">
                            {recipient.openedAt ? new Date(recipient.openedAt).toLocaleString() : "Not opened"}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">
                            {recipient.completedAt ? new Date(recipient.completedAt).toLocaleString() : "Not submitted"}
                          </td>
                          <td className="py-2.5 px-3">
                            {durationMs != null ? (
                              <span className="text-xs font-medium text-foreground">{fmtDuration(durationMs)}</span>
                            ) : inProgressMs != null ? (
                              <span className="text-xs text-sky-700">In progress ({fmtDuration(inProgressMs)})</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* Modal rendered at top level so it's always present regardless of active tab */}
      {showCreatePublicLink && (
        <CreatePublicLinkModal
          requestId={id}
          recipients={request.recipients}
          onClose={() => setShowCreatePublicLink(false)}
          onCreated={(link) => {
            setPublicLinks((prev) => [link as unknown as PublicLink, ...prev]);
            setShowCreatePublicLink(false);
          }}
        />
      )}
    </div>
  );
}

function CreatePublicLinkModal({
  requestId,
  recipients,
  onClose,
  onCreated,
}: {
  requestId: string;
  recipients: Recipient[];
  onClose: () => void;
  onCreated: (link: PublicLink) => void;
}) {
  const recipientsWithFields = recipients;
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState<"unlimited" | number>("unlimited");
  const [maxUsesInput, setMaxUsesInput] = useState("10");
  const [requireName, setRequireName] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [slotRecipientId, setSlotRecipientId] = useState(recipientsWithFields[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/signing/requests/${requestId}/public-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          maxUses: maxUses === "unlimited" ? null : Number(maxUsesInput) || null,
          requireName,
          requireEmail,
          slotRecipientId: slotRecipientId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to create link.");
      onCreated((data as { link: PublicLink }).link);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link.");
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
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Create Public Signing Link</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Anyone with this link can open the document and sign — no email required.</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Label <span className="font-normal">(optional)</span></label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Open House 123 Main St" className="h-9 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">Max Uses</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMaxUses("unlimited")}
                className={`flex-1 h-9 rounded-lg border text-sm transition-colors ${maxUses === "unlimited" ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                Unlimited
              </button>
              <button
                type="button"
                onClick={() => setMaxUses(Number(maxUsesInput) || 10)}
                className={`flex-1 h-9 rounded-lg border text-sm transition-colors ${maxUses !== "unlimited" ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                Limited
              </button>
            </div>
            {maxUses !== "unlimited" && (
              <div className="mt-2">
                <Input
                  type="number"
                  min="1"
                  value={maxUsesInput}
                  onChange={(e) => { setMaxUsesInput(e.target.value); setMaxUses(Number(e.target.value) || 1); }}
                  className="h-9 text-sm"
                  placeholder="10"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">Collect from signers</label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={requireName} onChange={(e) => setRequireName(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">Require full name</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={requireEmail} onChange={(e) => setRequireEmail(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">Require email address</span>
            </label>
          </div>

          {recipientsWithFields.length > 1 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Public signer fills this slot</label>
              <select
                value={slotRecipientId}
                onChange={(e) => setSlotRecipientId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {recipientsWithFields.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                ))}
              </select>
            </div>
          )}

        </div>
        <div className="px-5 py-3 border-t border-border flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={() => void handleCreate()} disabled={busy || !slotRecipientId}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Create Link
          </Button>
        </div>
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

  async function handleConfirm() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    if (!email.trim()) { toast.error("Email is required."); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/signing/requests/${requestId}/recipients/${recipient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to reassign.");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign.");
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
          <p className="text-xs text-muted-foreground mt-0.5">The original signing link will be invalidated and a new invitation sent.</p>
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
