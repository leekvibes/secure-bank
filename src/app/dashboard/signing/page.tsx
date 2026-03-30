"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock3,
  FileSignature,
  Filter,
  Loader2,
  Plus,
  Search,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type SigningStatus = "DRAFT" | "SENT" | "OPENED" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type StatusFilter = "ALL" | "DRAFT" | "SENT" | "PARTIALLY_SIGNED" | "COMPLETED" | "VOIDED" | "EXPIRED";
type SortMode = "NEWEST" | "OLDEST" | "ATTENTION";

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

function matchesStatus(request: SigningRequestListItem, filter: StatusFilter) {
  if (filter === "ALL") return true;
  const status = resolveDisplayStatus(request);
  return status === filter || (filter === "SENT" && status === "OPENED");
}

function inSearch(request: SigningRequestListItem, search: string) {
  if (!search.trim()) return true;
  const q = search.toLowerCase();
  const title = request.title?.toLowerCase() ?? "";
  const file = request.originalName?.toLowerCase() ?? "";
  const recipientHit = request.recipients.some((recipient) =>
    `${recipient.name} ${recipient.email}`.toLowerCase().includes(q),
  );
  return title.includes(q) || file.includes(q) || recipientHit;
}

export default function AgreementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SigningRequestListItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("NEWEST");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signing/requests?includeDeleted=false", { cache: "no-store" });
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

  const filtered = useMemo(() => {
    const base = requests
      .filter((request) => !request.deletedAt)
      .filter((request) => matchesStatus(request, statusFilter))
      .filter((request) => inSearch(request, search));

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
  }, [requests, statusFilter, search, sortMode]);

  const filters: Array<{ key: StatusFilter; label: string }> = [
    { key: "ALL", label: "All" },
    { key: "DRAFT", label: "Draft" },
    { key: "SENT", label: "Sent" },
    { key: "PARTIALLY_SIGNED", label: "Partially Signed" },
    { key: "COMPLETED", label: "Completed" },
    { key: "VOIDED", label: "Voided" },
    { key: "EXPIRED", label: "Expired" },
  ];

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

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === filter.key
                  ? "border-primary/40 bg-primary/12 text-primary shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="h-44 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
          <FileSignature className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No agreements match this view</p>
          <p className="text-xs text-muted-foreground mt-1">Try clearing filters or create a new agreement.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((request) => {
            const status = resolveDisplayStatus(request);
            const badge = statusBadge(status);
            const completed = typeof request.completedRecipients === "number"
              ? request.completedRecipients
              : request.recipients.filter((recipient) => recipient.status === "COMPLETED").length;
            const completionPercent = request.recipients.length > 0 ? Math.round((completed / request.recipients.length) * 100) : 0;

            return (
              <article key={request.id} className={`rounded-2xl border bg-gradient-to-br ${statusCardTone(status)} p-4 flex flex-col gap-4 hover:border-primary/30 transition-colors shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {request.title?.trim() || request.originalName || "Untitled agreement"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{request.originalName || "No uploaded file name"}</p>
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

                <div className="pt-1 flex items-center justify-end">
                  <Button asChild size="sm" className="gap-1.5 h-8 px-3">
                    <Link href={`/dashboard/signing/${request.id}`}>
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
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
