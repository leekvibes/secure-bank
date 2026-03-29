"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  FileSignature,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Send,
  ArrowRight,
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
}

function resolveDisplayStatus(request: SigningRequestListItem): SigningStatus {
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

function statusBadge(status: SigningStatus) {
  if (status === "DRAFT") return { label: "Draft", className: "bg-muted text-muted-foreground" };
  if (status === "PARTIALLY_SIGNED") {
    return { label: "Partially Signed", className: "bg-violet-500/10 text-violet-700" };
  }
  if (status === "SENT" || status === "OPENED") {
    return { label: status === "OPENED" ? "Opened" : "Sent", className: "bg-blue-500/10 text-blue-700" };
  }
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

export default function SigningRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SigningRequestListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/signing/requests", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to load signing requests.");
        if (!cancelled) setRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load signing requests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const statuses = requests.map(resolveDisplayStatus);
    return {
      all: requests.length,
      draft: statuses.filter((status) => status === "DRAFT").length,
      sent: statuses.filter((status) => status === "SENT" || status === "OPENED").length,
      partial: statuses.filter((status) => status === "PARTIALLY_SIGNED").length,
      completed: statuses.filter((status) => status === "COMPLETED").length,
    };
  }, [requests]);

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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold text-foreground">{totals.all}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Draft</p>
          <p className="text-lg font-semibold text-foreground">{totals.draft}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Sent</p>
          <p className="text-lg font-semibold text-foreground">{totals.sent}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Partially Signed</p>
          <p className="text-lg font-semibold text-foreground">{totals.partial}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-lg font-semibold text-foreground">{totals.completed}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-44 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileSignature className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No signing requests yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-5">
            Create your first request to upload a PDF and collect signatures.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/signing/new">Create First Request</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const displayStatus = resolveDisplayStatus(request);
            const badge = statusBadge(displayStatus);
            const completedRecipients =
              typeof request.completedRecipients === "number"
                ? request.completedRecipients
                : request.recipients.filter((recipient) => recipient.status === "COMPLETED").length;
            return (
              <Link
                key={request.id}
                href={`/dashboard/signing/${request.id}`}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {request.title?.trim() || request.originalName || "Untitled request"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {request.originalName || "No document uploaded"} · {request.recipients.length} recipient{request.recipients.length === 1 ? "" : "s"} · {request._count.signingFields} field{request._count.signingFields === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusIcon(displayStatus)}
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Progress: {completedRecipients}/{request.recipients.length} signed
                  </span>
                  <span>Mode: {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"}</span>
                  <span>{request.status === "DRAFT" ? "Created" : "Sent"}: {new Date(request.createdAt).toLocaleString()}</span>
                  <span>Expires: {new Date(request.expiresAt).toLocaleString()}</span>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    View details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
