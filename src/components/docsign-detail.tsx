"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature, CheckCircle2, Clock, Send, AlertCircle,
  Download, Trash2, ArrowLeft, Copy, CheckCheck, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface AuditLog { id: string; event: string; metadata: string | null; createdAt: string; }

interface DocSignRequestData {
  id: string;
  token: string;
  title: string | null;
  message: string | null;
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  originalName: string | null;
  fieldsJson: string | null;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
  auditLogs: AuditLog[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  DRAFT:     { label: "Draft",               icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50" },
  SENT:      { label: "Awaiting signature",  icon: Send,         color: "text-blue-600",   bg: "bg-blue-50" },
  OPENED:    { label: "Opened by client",    icon: Clock,        color: "text-violet-600", bg: "bg-violet-50" },
  COMPLETED: { label: "Signed",              icon: CheckCircle2, color: "text-emerald-600",bg: "bg-emerald-50" },
  EXPIRED:   { label: "Expired",             icon: AlertCircle,  color: "text-red-500",    bg: "bg-red-50" },
};

const EVENT_LABELS: Record<string, string> = {
  CREATED:   "Signing request created",
  SENT:      "Sent to client",
  OPENED:    "Opened by client",
  SIGNED:    "Fields completed",
  COMPLETED: "Document signed and finalized",
};

export function DocSignDetail({ doc }: { doc: DocSignRequestData }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const signUrl = `${appUrl}/sign/${doc.token}`;
  const fields = doc.fieldsJson ? JSON.parse(doc.fieldsJson) : [];
  const clientFields = fields.filter((f: { assignedTo: string }) => f.assignedTo === "CLIENT");
  const agentFields = fields.filter((f: { assignedTo: string }) => f.assignedTo === "AGENT");

  const status = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.DRAFT;
  const StatusIcon = status.icon;

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/docsign/${doc.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSendError(data?.error?.message ?? "Failed to send."); return; }
      router.refresh();
    } catch { setSendError("Network error."); }
    finally { setSending(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this signing request? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/docsign/${doc.id}`, { method: "DELETE" });
      router.push("/dashboard/docsign");
    } catch { setDeleting(false); }
  }

  function handleDownloadSigned() {
    window.open(`/api/docsign/${doc.id}/signed`, "_blank");
  }

  function copySignUrl() {
    navigator.clipboard.writeText(signUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push("/dashboard/docsign")}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{doc.title ?? "Untitled document"}</h1>
          <p className="text-sm text-muted-foreground">{doc.originalName}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className={cn("flex items-center gap-3 p-4 rounded-xl mb-6", status.bg)}>
        <StatusIcon className={cn("w-5 h-5 shrink-0", status.color)} />
        <div>
          <p className={cn("font-semibold", status.color)}>{status.label}</p>
          {doc.completedAt && (
            <p className="text-sm text-muted-foreground">
              Completed {format(new Date(doc.completedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
          {doc.status !== "COMPLETED" && (
            <p className="text-sm text-muted-foreground">
              Expires {formatDistanceToNow(new Date(doc.expiresAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Client info */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Client</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{doc.clientName ?? "—"}</p>
            <p>{doc.clientEmail ?? "No email"}</p>
          </div>
          {doc.status === "DRAFT" && (
            <div className="pt-1 space-y-2">
              {doc.clientEmail && (
                <Button size="sm" onClick={handleSend} disabled={sending} className="w-full gap-2">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send via email
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={copySignUrl} className="w-full gap-2">
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy signing link"}
              </Button>
              {sendError && <p className="text-xs text-red-500">{sendError}</p>}
            </div>
          )}
          {(doc.status === "SENT" || doc.status === "OPENED") && (
            <Button size="sm" variant="outline" onClick={copySignUrl} className="w-full gap-2">
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy signing link"}
            </Button>
          )}
        </div>

        {/* Fields summary */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Signature fields</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{clientFields.length} field(s) for client</p>
            <p>{agentFields.length} field(s) pre-signed by you</p>
          </div>
          {doc.status === "COMPLETED" && (
            <Button size="sm" onClick={handleDownloadSigned} className="w-full gap-2">
              <Download className="w-3.5 h-3.5" />
              Download signed document
            </Button>
          )}
        </div>
      </div>

      {/* Audit timeline */}
      {doc.auditLogs.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-foreground mb-4">Activity</p>
          <div className="space-y-3">
            {doc.auditLogs.map((log, i) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{EVENT_LABELS[log.event] ?? log.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2">
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete request
        </Button>
      </div>
    </div>
  );
}
