"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Shield, Clock, Download, Trash2, Share2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LINK_TYPES, formatDate, type LinkType } from "@/lib/utils";
import { shareLink } from "@/lib/share";

interface SubmissionViewerProps {
  submission: {
    id: string;
    encryptedData: string;
    revealedAt: Date | null;
    revealCount: number;
    deleteAt: Date;
    createdAt: Date;
    link: {
      id: string;
      token: string;
      linkType: string;
      clientName: string | null;
      status: string;
    };
  };
  auditLogs: {
    id: string;
    event: string;
    createdAt: Date;
    userAgent: string | null;
  }[];
  maskedSsn?: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  LINK_CREATED: "Link created",
  LINK_SENT: "Link sent to client",
  LINK_OPENED: "Link opened by client",
  SUBMITTED: "Client submitted form",
  REVEALED: "Agent revealed data",
  SSN_OPENED: "SSN link opened by client",
  SSN_SUBMITTED: "SSN form submitted",
  SSN_REVEALED: "Agent revealed SSN data",
  EXPORTED: "Data exported",
  DELETED: "Submission deleted",
  EXPIRED: "Link expired",
};

export function SubmissionViewer({
  submission,
  auditLogs,
  maskedSsn,
}: SubmissionViewerProps) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shared, setShared] = useState(false);

  const alreadyRevealed = submission.revealedAt !== null;

  async function handleDelete() {
    if (!confirm("Permanently delete this submission and its link? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${submission.link.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  function exportUrl(format: string) {
    return `/api/submissions/${submission.id}/export?format=${format}`;
  }

  const secureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/secure/${submission.link.token}`
      : `/secure/${submission.link.token}`;

  async function handleShare() {
    try {
      const result = await shareLink({
        title: "Secure Submission Link",
        text: "Use this private encrypted link to submit your information securely.",
        url: secureUrl,
      });
      if (result === "shared" || result === "copied") {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // User cancelled share dialog or clipboard permission was denied.
    }
  }

  async function revealData() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/submissions/${submission.id}/reveal`, {
      method: "POST",
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to reveal data.");
      return;
    }

    setFields(data.fields);
    setRevealed(true);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare}>
            {shared ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
            {shared ? "Shared" : "Share"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={exportUrl("json")} download>
              <Download className="w-3.5 h-3.5" />
              JSON
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={exportUrl("text")} download>
              <Download className="w-3.5 h-3.5" />
              TXT
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:bg-red-50 hover:border-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="ui-page-title">Submission</h1>
        <p className="text-sm text-slate-500 mt-1">
          {LINK_TYPES[submission.link.linkType as LinkType]}{" "}
          {submission.link.clientName && `· ${submission.link.clientName}`}
        </p>
      </div>

      {/* Data card */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="ui-section-title">Submitted data</CardTitle>
            <span className="text-xs text-slate-400">
              Deletes {formatDate(submission.deleteAt)}
            </span>
          </div>
          <CardDescription>
            Submitted {formatDate(submission.createdAt)}
            {submission.revealCount > 0 &&
              ` · Revealed ${submission.revealCount} time${submission.revealCount > 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {maskedSsn && !revealed && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">SSN (masked): </span>
              <span className="font-mono text-slate-800">{maskedSsn}</span>
            </div>
          )}
          {revealed && fields ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-lg p-2.5 text-sm">
                <Eye className="w-4 h-4 shrink-0" />
                <span>Data decrypted successfully.</span>
              </div>
              <div className="space-y-2">
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-500 w-40 shrink-0 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-sm font-mono text-slate-900 break-all">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRevealed(false); setFields(null); }}
                className="mt-2"
              >
                <EyeOff className="w-4 h-4" />
                Hide data
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Data is encrypted</p>
                <p className="text-sm text-slate-500 mt-1">
                  Click to decrypt and reveal the submitted information.
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <Button onClick={revealData} disabled={loading}>
                <Eye className="w-4 h-4" />
                {loading ? "Decrypting..." : "Reveal submission"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="ui-section-title flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Activity log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400">No activity recorded.</p>
          ) : (
            <div className="space-y-0">
              {auditLogs.map((log, i) => (
                <div key={log.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-700">
                      {EVENT_LABELS[log.event] ?? log.event}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  {i < auditLogs.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
