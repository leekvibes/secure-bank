"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SigningStatus =
  | "DRAFT"
  | "SENT"
  | "OPENED"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "VOIDED"
  | "EXPIRED";

type Tab = "ALL" | "DRAFTS" | "ACTIVE" | "COMPLETED" | "CLOSED";

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
  if (
    (request.status === "SENT" || request.status === "OPENED") &&
    completedCount > 0 &&
    completedCount < request.recipients.length
  ) {
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

function getTabForStatus(s: SigningStatus): Tab {
  if (s === "DRAFT") return "DRAFTS";
  if (s === "SENT" || s === "OPENED" || s === "PARTIALLY_SIGNED") return "ACTIVE";
  if (s === "COMPLETED") return "COMPLETED";
  return "CLOSED"; // VOIDED / EXPIRED
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "DRAFTS", label: "Drafts" },
  { id: "ACTIVE", label: "Active" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CLOSED", label: "Voided / Expired" },
];

export default function SigningRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SigningRequestListItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signing/requests", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to load signing requests.");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signing requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let active = true;
    async function run() {
      await load();
      if (cancelled) return;
    }
    void run();
    return () => { cancelled = true; active = false; void active; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { ALL: requests.length, DRAFTS: 0, ACTIVE: 0, COMPLETED: 0, CLOSED: 0 };
    requests.forEach((r) => {
      const tab = getTabForStatus(resolveDisplayStatus(r));
      counts[tab]++;
    });
    return counts;
  }, [requests]);

  const displayed = useMemo(() => {
    if (activeTab === "ALL") return requests;
    return requests.filter((r) => getTabForStatus(resolveDisplayStatus(r)) === activeTab);
  }, [requests, activeTab]);

  async function handleDelete(requestId: string) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to delete request.");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete request.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="ui-page-title">Document Signing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage draft, sent, and completed signing requests.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/signing/new">
            <Plus className="w-4 h-4" />
            New Request
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-0 -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {deleteError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
      )}

      {loading ? (
        <div className="h-44 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileSignature className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">
            {activeTab === "ALL" ? "No signing requests yet" : `No ${TABS.find((t) => t.id === activeTab)?.label.toLowerCase()} requests`}
          </p>
          {activeTab === "ALL" && (
            <>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Create your first request to upload a PDF and collect signatures.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/signing/new">Create First Request</Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((request) => {
            const displayStatus = resolveDisplayStatus(request);
            const badge = statusBadge(displayStatus);
            const completedRecipients =
              typeof request.completedRecipients === "number"
                ? request.completedRecipients
                : request.recipients.filter((r) => r.status === "COMPLETED").length;
            const isEditable = request.isEditable ?? displayStatus === "DRAFT";
            const canDelete =
              displayStatus === "DRAFT" || displayStatus === "VOIDED" || displayStatus === "EXPIRED";
            const isConfirmingDelete = confirmDeleteId === request.id;

            return (
              <div
                key={request.id}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/dashboard/signing/${request.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {request.title?.trim() || request.originalName || "Untitled request"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {request.originalName || "No document uploaded"} · {request.recipients.length} recipient{request.recipients.length === 1 ? "" : "s"} · {request._count.signingFields} field{request._count.signingFields === 1 ? "" : "s"}
                    </p>
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
                  <span>Expires: {new Date(request.expiresAt).toLocaleString()}</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isEditable && (
                      <Button variant="outline" size="sm" asChild className="gap-1.5 h-7 text-xs">
                        <Link href={`/dashboard/signing/${request.id}/edit-fields`}>
                          <Edit2 className="w-3 h-3" />
                          Edit Fields
                        </Link>
                      </Button>
                    )}
                    {canDelete && !isConfirmingDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => { setDeleteError(null); setConfirmDeleteId(request.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    )}
                    {isConfirmingDelete && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive">Delete this request?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={deleteBusy}
                          onClick={() => handleDelete(request.id)}
                        >
                          {deleteBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/signing/${request.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    View details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
