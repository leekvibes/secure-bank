"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSignature,
  Filter,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type SigningStatus = "DRAFT" | "SENT" | "OPENED" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type SortMode = "NEWEST" | "OLDEST" | "ATTENTION";
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
  if (status === "DRAFT") return { label: "Draft", className: "bg-slate-200 text-slate-700" };
  if (status === "PARTIALLY_SIGNED") return { label: "Partially Signed", className: "bg-amber-100 text-amber-800" };
  if (status === "SENT" || status === "OPENED") return { label: "Sent", className: "bg-blue-100 text-blue-800" };
  if (status === "COMPLETED") return { label: "Completed", className: "bg-emerald-100 text-emerald-800" };
  if (status === "VOIDED") return { label: "Voided", className: "bg-orange-100 text-orange-800" };
  return { label: "Expired", className: "bg-rose-100 text-rose-800" };
}

function statusIcon(status: SigningStatus) {
  if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  if (status === "PARTIALLY_SIGNED") return <AlertTriangle className="w-4 h-4 text-amber-600" />;
  if (status === "SENT" || status === "OPENED") return <Send className="w-4 h-4 text-blue-600" />;
  if (status === "VOIDED") return <Ban className="w-4 h-4 text-orange-600" />;
  if (status === "EXPIRED") return <Clock3 className="w-4 h-4 text-rose-600" />;
  return <FileSignature className="w-4 h-4 text-slate-600" />;
}

function statusCardTone(status: SigningStatus) {
  if (status === "COMPLETED") return "from-emerald-50 to-white border-emerald-200/70";
  if (status === "PARTIALLY_SIGNED") return "from-amber-50 to-white border-amber-200/70";
  if (status === "SENT" || status === "OPENED") return "from-blue-50 to-white border-blue-200/70";
  if (status === "VOIDED") return "from-orange-50 to-white border-orange-200/70";
  if (status === "EXPIRED") return "from-rose-50 to-white border-rose-200/70";
  return "from-slate-50 to-white border-slate-200/70";
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
        if (s === "PARTIALLY_SIGNED" || s === "EXPIRED") return true;
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

function inSearch(request: SigningRequestListItem, search: string) {
  if (!search.trim()) return true;
  const q = search.toLowerCase();
  const title = request.title?.toLowerCase() ?? "";
  const file = request.originalName?.toLowerCase() ?? "";
  const recipientHit = request.recipients.some((recipient) => `${recipient.name} ${recipient.email}`.toLowerCase().includes(q));
  return title.includes(q) || file.includes(q) || recipientHit;
}

export default function AgreementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SigningRequestListItem[]>([]);

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("NEWEST");
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
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const metrics = useMemo(() => {
    const visible = requests.filter((request) => !request.deletedAt);
    return {
      total: visible.length,
      sent: visible.filter((request) => {
        const status = resolveDisplayStatus(request);
        return status === "SENT" || status === "OPENED";
      }).length,
      partial: visible.filter((request) => resolveDisplayStatus(request) === "PARTIALLY_SIGNED").length,
      completed: visible.filter((request) => resolveDisplayStatus(request) === "COMPLETED").length,
    };
  }, [requests]);

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

  const tabCounts = useMemo(() => {
    const counts: Record<AnyTab, number> = {
      ALL: 0,
      COMPLETED: 0,
      SENT: 0,
      ACTION_REQUIRED: 0,
      DRAFTS: 0,
      DELETED: 0,
      EXPIRING_SOON: 0,
      DECLINED: 0,
    };
    (["ALL", "COMPLETED", "SENT", "ACTION_REQUIRED", "DRAFTS", "DELETED", "EXPIRING_SOON", "DECLINED"] as AnyTab[]).forEach((tab) => {
      counts[tab] = filterRequests(requests, tab).length;
    });
    return counts;
  }, [requests]);

  const displayed = useMemo(() => {
    const base = filterRequests(requests, activeTab).filter((request) => inSearch(request, search));
    const sorted = [...base];
    if (sortMode === "NEWEST") {
      sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (sortMode === "OLDEST") {
      sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    } else {
      const weight = (r: SigningRequestListItem) => {
        const status = resolveDisplayStatus(r);
        if (status === "PARTIALLY_SIGNED") return 0;
        if (status === "EXPIRED") return 1;
        if (status === "SENT" || status === "OPENED") return 2;
        if (status === "DRAFT") return 3;
        if (status === "VOIDED") return 4;
        return 5;
      };
      sorted.sort((a, b) => weight(a) - weight(b) || +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return sorted;
  }, [requests, activeTab, search, sortMode]);

  const isMoreActive = MORE_TABS.some((tab) => tab.id === activeTab);

  async function handleDelete(requestId: string) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to delete.");
      if (data.deletedAt) {
        setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, deletedAt: data.deletedAt } : r)));
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
      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, deletedAt: null } : r)));
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="ui-page-title">Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">Track signature requests with a cleaner, card-first control center.</p>
        </div>
        <Button asChild className="gap-2 h-10 px-4">
          <Link href="/dashboard/signing/new">
            <Plus className="w-4 h-4" />
            New Agreement
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Requests" value={metrics.total} tone="neutral" />
        <MetricCard label="Sent" value={metrics.sent} tone="blue" />
        <MetricCard label="Partially Signed" value={metrics.partial} tone="amber" />
        <MetricCard label="Completed" value={metrics.completed} tone="emerald" />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-50/90 via-white to-blue-50/40 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, file name, recipient name, or email"
              className="pl-9 h-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2">
              <Filter className="w-3.5 h-3.5" />
              Sort
            </span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="NEWEST">Newest first</option>
              <option value="OLDEST">Oldest first</option>
              <option value="ATTENTION">Needs attention</option>
            </select>
          </div>
        </div>

        <div className="flex items-end border-b border-border -mb-px">
          <div className="flex items-end gap-1 overflow-x-auto pb-0 flex-1 min-w-0">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowMoreOpen(false);
                }}
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
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[170px]">
                {MORE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMoreOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-muted/60 transition-colors ${
                      activeTab === tab.id ? "text-primary font-medium" : "text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {tab.id === "DELETED" && <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />}
                      {tab.id === "EXPIRING_SOON" && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                      {tab.id === "DECLINED" && <Ban className="w-3.5 h-3.5 text-red-500" />}
                      {tab.id === "DRAFTS" && <Clock3 className="w-3.5 h-3.5 text-muted-foreground" />}
                      {tab.label}
                    </span>
                    {tabCounts[tab.id] > 0 && (
                      <span className="text-[11px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">{tabCounts[tab.id]}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {deleteError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div> : null}

      {activeTab === "DELETED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Deleted Inbox</strong> — Items are kept for 90 days before permanent deletion.
        </div>
      ) : null}

      {loading ? (
        <div className="h-44 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
          <FileSignature className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">{emptyLabel[activeTab]}</p>
          <p className="text-xs text-muted-foreground mt-1">Try clearing filters or create a new agreement.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {displayed.map((request) => {
            const status = resolveDisplayStatus(request);
            const badge = statusBadge(status);
            const completed = typeof request.completedRecipients === "number"
              ? request.completedRecipients
              : request.recipients.filter((recipient) => recipient.status === "COMPLETED").length;
            const completionPercent = request.recipients.length > 0 ? Math.round((completed / request.recipients.length) * 100) : 0;
            const isDeleted = !!request.deletedAt;
            const isConfirmingDelete = confirmDeleteId === request.id;
            const daysLeft = isDeleted && request.deletedAt ? daysUntilPermanentDelete(request.deletedAt) : null;

            return (
              <article key={request.id} className={`rounded-2xl border bg-gradient-to-br ${statusCardTone(status)} p-4 flex flex-col gap-4 hover:border-primary/30 transition-colors shadow-sm ${isDeleted ? "opacity-80" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{request.title?.trim() || request.originalName || "Untitled agreement"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{request.originalName || "No uploaded file name"}</p>
                    {isDeleted && daysLeft !== null ? (
                      <p className="text-[11px] text-red-600 mt-1">Permanent deletion in {daysLeft} day{daysLeft === 1 ? "" : "s"}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {statusIcon(status)}
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Recipients" value={request.recipients.length} />
                  <MiniStat label="Fields" value={request._count.signingFields} />
                  <MiniStat label="Progress" value={`${completionPercent}%`} />
                </div>

                <div className="space-y-2">
                  <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full" style={{ width: `${completionPercent}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {completed}/{request.recipients.length} signed · {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"} flow
                  </p>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Created: {new Date(request.createdAt).toLocaleDateString()}</span>
                  <span>Expires: {new Date(request.expiresAt).toLocaleDateString()}</span>
                </div>

                <div className="pt-1 flex items-center justify-between gap-2">
                  {isDeleted ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        disabled={restoreBusy === request.id}
                        onClick={() => void handleRestore(request.id)}
                      >
                        {restoreBusy === request.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Restore
                      </Button>

                      {!isConfirmingDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmDeleteId(request.id);
                          }}
                        >
                          Delete Forever
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8"
                            disabled={deleteBusy}
                            onClick={() => void handlePermanentDelete(request.id)}
                          >
                            {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {!isConfirmingDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmDeleteId(request.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button variant="destructive" size="sm" className="h-8" disabled={deleteBusy} onClick={() => void handleDelete(request.id)}>
                            {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm delete"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      <Button asChild size="sm" className="gap-1.5 h-8 px-3">
                        <Link href={`/dashboard/signing/${request.id}`}>
                          View Details
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "blue" | "amber" | "emerald" }) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50"
          : "border-border bg-card";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
