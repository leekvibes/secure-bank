"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Edit2,
  FileSignature,
  Loader2,
  Plus,
  Send,
  Trash2,
  ChevronDown,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SigningStatus = "DRAFT" | "SENT" | "OPENED" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type MainTab = "ALL" | "COMPLETED" | "SENT" | "ACTION_REQUIRED";
type MoreTab = "DRAFTS" | "DELETED" | "EXPIRING_SOON" | "DECLINED";
type AnyTab = MainTab | MoreTab;

interface SigningRecipient {
  id: string;
  name: string;
  email: string;
  status: string;
  order: number;
  completedAt: string | null;
}

interface SigningRequestListItem {
  id: string;
  token: string;
  title: string | null;
  status: SigningStatus;
  signingMode: "PARALLEL" | "SEQUENTIAL" | string;
  originalName: string | null;
  expiresAt: string;
  completedAt: string | null;
  voidedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  recipients: SigningRecipient[];
  _count: { signingFields: number };
  displayStatus?: SigningStatus;
  completedRecipients?: number;
  isEditable?: boolean;
}

function resolveDisplayStatus(request: SigningRequestListItem): SigningStatus {
  if (request.displayStatus) return request.displayStatus;
  const completedCount = request.recipients.filter((r) => r.status === "COMPLETED").length;
  if ((request.status === "SENT" || request.status === "OPENED") && completedCount > 0 && completedCount < request.recipients.length) {
    return "PARTIALLY_SIGNED";
  }
  return request.status;
}

function statusBadge(status: SigningStatus) {
  if (status === "DRAFT") return { label: "Draft", className: "bg-muted text-muted-foreground" };
  if (status === "PARTIALLY_SIGNED") return { label: "Partially Signed", className: "bg-violet-500/10 text-violet-700" };
  if (status === "SENT") return { label: "Sent", className: "bg-blue-500/10 text-blue-700" };
  if (status === "OPENED") return { label: "Opened", className: "bg-blue-500/10 text-blue-700" };
  if (status === "COMPLETED") return { label: "Completed", className: "bg-emerald-500/10 text-emerald-600" };
  if (status === "VOIDED") return { label: "Voided", className: "bg-orange-500/10 text-orange-600" };
  return { label: "Expired", className: "bg-red-500/10 text-red-600" };
}

function statusIcon(status: SigningStatus) {
  if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "PARTIALLY_SIGNED") return <CheckCircle2 className="w-4 h-4 text-violet-600" />;
  if (status === "SENT" || status === "OPENED") return <Send className="w-4 h-4 text-blue-600" />;
  if (status === "VOIDED") return <Ban className="w-4 h-4 text-orange-500" />;
  if (status === "EXPIRED") return <AlertTriangle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function daysUntilPermanentDelete(deletedAt: string): number {
  const retentionDays = 90;
  const permanentDeleteAt = new Date(new Date(deletedAt).getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((permanentDeleteAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function filterRequests(requests: SigningRequestListItem[], tab: AnyTab): SigningRequestListItem[] {
  switch (tab) {
    case "ALL":
      return requests.filter((r) => !r.deletedAt);
    case "COMPLETED":
      return requests.filter((r) => !r.deletedAt && resolveDisplayStatus(r) === "COMPLETED");
    case "SENT":
      return requests.filter((r) => {
        if (r.deletedAt) return false;
        const s = resolveDisplayStatus(r);
        return s === "SENT" || s === "OPENED";
      });
    case "ACTION_REQUIRED":
      return requests.filter((r) => {
        if (r.deletedAt) return false;
        const s = resolveDisplayStatus(r);
        if (s === "PARTIALLY_SIGNED") return true;
        return r.recipients.some((rec) => rec.status === "DECLINED");
      });
    case "DRAFTS":
      return requests.filter((r) => !r.deletedAt && r.status === "DRAFT");
    case "DELETED":
      return requests.filter((r) => !!r.deletedAt);
    case "EXPIRING_SOON": {
      const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
      return requests.filter((r) => {
        if (r.deletedAt) return false;
        const s = resolveDisplayStatus(r);
        if (s === "COMPLETED" || s === "VOIDED" || s === "EXPIRED") return false;
        return new Date(r.expiresAt).getTime() < sevenDays;
      });
    }
    case "DECLINED":
      return requests.filter((r) => !r.deletedAt && r.recipients.some((rec) => rec.status === "DECLINED"));
    default:
      return requests.filter((r) => !r.deletedAt);
  }
}

export default function AgreementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SigningRequestListItem[]>([]);
  const [activeTab, setActiveTab] = useState<AnyTab>("ALL");
  const [showMoreOpen, setShowMoreOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signing/requests?includeDeleted=true", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to load agreements.");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agreements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close "Show More" dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<AnyTab, number> = {
      ALL: 0, COMPLETED: 0, SENT: 0, ACTION_REQUIRED: 0,
      DRAFTS: 0, DELETED: 0, EXPIRING_SOON: 0, DECLINED: 0,
    };
    (["ALL", "COMPLETED", "SENT", "ACTION_REQUIRED", "DRAFTS", "DELETED", "EXPIRING_SOON", "DECLINED"] as AnyTab[]).forEach((tab) => {
      counts[tab] = filterRequests(requests, tab).length;
    });
    return counts;
  }, [requests]);

  const displayed = useMemo(() => filterRequests(requests, activeTab), [requests, activeTab]);

  const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
    { id: "ALL", label: "All" },
    { id: "COMPLETED", label: "Completed" },
    { id: "SENT", label: "Sent" },
    { id: "ACTION_REQUIRED", label: "Action Required" },
  ];
  const MORE_TABS: Array<{ id: MoreTab; label: string }> = [
    { id: "DRAFTS", label: "Drafts" },
    { id: "DELETED", label: "Deleted" },
    { id: "EXPIRING_SOON", label: "Expiring Soon" },
    { id: "DECLINED", label: "Declined" },
  ];
  const isMoreActive = MORE_TABS.some((t) => t.id === activeTab);

  async function handleDelete(requestId: string) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to delete.");
      // Mark as deleted in local state (soft delete returns deletedAt)
      if (data.deletedAt) {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, deletedAt: data.deletedAt } : r));
      } else {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleRestore(requestId: string) {
    setRestoreBusy(requestId);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to restore.");
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, deletedAt: null } : r));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to restore.");
    } finally {
      setRestoreBusy(null);
    }
  }

  async function handlePermanentDelete(requestId: string) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      // Second DELETE on an already-deleted item = permanent delete
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to permanently delete.");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to permanently delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const emptyLabel: Record<AnyTab, string> = {
    ALL: "No agreements yet",
    COMPLETED: "No completed agreements",
    SENT: "No sent agreements",
    ACTION_REQUIRED: "Nothing requires action",
    DRAFTS: "No drafts",
    DELETED: "Deleted inbox is empty",
    EXPIRING_SOON: "No agreements expiring soon",
    DECLINED: "No declined agreements",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="ui-page-title">Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your document signing requests and agreements.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/signing/new">
            <Plus className="w-4 h-4" />
            New Agreement
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-end border-b border-border -mb-px">
        <div className="flex items-end gap-1 overflow-x-auto pb-0 flex-1 min-w-0">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setShowMoreOpen(false); }}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className="ml-1.5 text-[11px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Show More dropdown — outside overflow container so dropdown isn't clipped */}
        <div className="relative flex-shrink-0 pb-0" ref={moreRef}>
          <button
            type="button"
            onClick={() => setShowMoreOpen((v) => !v)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 flex items-center gap-1 transition-colors ${
              isMoreActive
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isMoreActive ? MORE_TABS.find((t) => t.id === activeTab)?.label : "More"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreOpen ? "rotate-180" : ""}`} />
          </button>
          {showMoreOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
              {MORE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveTab(tab.id); setShowMoreOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-muted/60 transition-colors ${
                    activeTab === tab.id ? "text-primary font-medium" : "text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {tab.id === "DELETED" && <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />}
                    {tab.id === "EXPIRING_SOON" && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                    {tab.id === "DECLINED" && <Ban className="w-3.5 h-3.5 text-red-500" />}
                    {tab.id === "DRAFTS" && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                    {tab.label}
                  </span>
                  {tabCounts[tab.id] > 0 && (
                    <span className="text-[11px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {tabCounts[tab.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {deleteError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>}

      {/* Deleted inbox banner */}
      {activeTab === "DELETED" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Deleted Inbox</strong> — Items here are kept for 90 days before permanent deletion. Restore anytime.
        </div>
      )}

      {loading ? (
        <div className="h-44 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileSignature className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">{emptyLabel[activeTab]}</p>
          {activeTab === "ALL" && (
            <>
              <p className="text-xs text-muted-foreground mt-1 mb-5">Create your first agreement to collect signatures.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/signing/new">Create First Agreement</Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((request) => {
            const displayStatus = resolveDisplayStatus(request);
            const badge = statusBadge(displayStatus);
            const completedRecipients = typeof request.completedRecipients === "number"
              ? request.completedRecipients
              : request.recipients.filter((r) => r.status === "COMPLETED").length;
            const isEditable = request.isEditable ?? displayStatus === "DRAFT";
            const isDeleted = !!request.deletedAt;
            const isConfirmingDelete = confirmDeleteId === request.id;
            const daysLeft = isDeleted ? daysUntilPermanentDelete(request.deletedAt!) : null;

            return (
              <div
                key={request.id}
                className={`rounded-xl border bg-card p-4 transition-colors ${isDeleted ? "border-red-200 opacity-75" : "border-border hover:border-primary/20"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/dashboard/signing/${request.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {request.title?.trim() || request.originalName || "Untitled agreement"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {request.originalName || "No document uploaded"} · {request.recipients.length} recipient{request.recipients.length === 1 ? "" : "s"} · {request._count.signingFields} field{request._count.signingFields === 1 ? "" : "s"}
                    </p>
                    {isDeleted && daysLeft !== null && (
                      <p className="text-xs text-red-500 mt-1">
                        Permanent deletion in {daysLeft} day{daysLeft === 1 ? "" : "s"}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusIcon(displayStatus)}
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Progress: {completedRecipients}/{request.recipients.length} signed</span>
                  <span>Mode: {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"}</span>
                  <span>{request.status === "DRAFT" ? "Created" : "Sent"}: {new Date(request.createdAt).toLocaleString()}</span>
                  {!isDeleted && <span>Expires: {new Date(request.expiresAt).toLocaleString()}</span>}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isDeleted ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          disabled={restoreBusy === request.id}
                          onClick={() => void handleRestore(request.id)}
                        >
                          {restoreBusy === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Restore
                        </Button>
                        {!isConfirmingDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => { setDeleteError(null); setConfirmDeleteId(request.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete Forever
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive">Permanently delete?</span>
                            <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={deleteBusy} onClick={() => handlePermanentDelete(request.id)}>
                              {deleteBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete Forever"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {isEditable && (
                          <Button variant="outline" size="sm" asChild className="gap-1.5 h-7 text-xs">
                            <Link href={`/dashboard/signing/${request.id}/edit-fields`}>
                              <Edit2 className="w-3 h-3" />
                              Edit Fields
                            </Link>
                          </Button>
                        )}
                        {!isConfirmingDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => { setDeleteError(null); setConfirmDeleteId(request.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive">Move to deleted?</span>
                            <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={deleteBusy} onClick={() => handleDelete(request.id)}>
                              {deleteBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {!isDeleted && (
                    <Link href={`/dashboard/signing/${request.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      View details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
