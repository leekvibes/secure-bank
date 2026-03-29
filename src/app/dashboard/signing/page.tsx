"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, FileSignature, Clock, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SigningStatus = "DRAFT" | "SENT" | "OPENED" | "COMPLETED" | "VOIDED" | "EXPIRED";

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
}

function statusBadge(status: SigningStatus) {
  if (status === "DRAFT") return { label: "Draft", className: "bg-muted text-muted-foreground" };
  if (status === "SENT" || status === "OPENED") return { label: status === "OPENED" ? "Opened" : "Sent", className: "bg-blue-500/10 text-blue-600" };
  if (status === "COMPLETED") return { label: "Completed", className: "bg-emerald-500/10 text-emerald-600" };
  if (status === "VOIDED") return { label: "Voided", className: "bg-orange-500/10 text-orange-600" };
  return { label: "Expired", className: "bg-red-500/10 text-red-600" };
}

function statusIcon(status: SigningStatus) {
  if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
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
    return {
      all: requests.length,
      draft: requests.filter((r) => r.status === "DRAFT").length,
      sent: requests.filter((r) => r.status === "SENT" || r.status === "OPENED").length,
      completed: requests.filter((r) => r.status === "COMPLETED").length,
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            const badge = statusBadge(request.status);
            return (
              <div key={request.id} className="rounded-xl border border-border bg-card p-4">
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
                    {statusIcon(request.status)}
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Mode: {request.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"}</span>
                  <span>Created: {new Date(request.createdAt).toLocaleString()}</span>
                  <span>Expires: {new Date(request.expiresAt).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

