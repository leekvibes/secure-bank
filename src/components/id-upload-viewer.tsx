"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Trash2, Clock, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";

interface Props {
  upload: {
    id: string;
    linkId: string;
    clientName: string | null;
    hasBack: boolean;
    viewedAt: Date | null;
    viewCount: number;
    deleteAt: Date;
    createdAt: Date;
    link: { id: string };
  };
  auditLogs: { id: string; event: string; createdAt: Date }[];
}

const EVENT_LABELS: Record<string, string> = {
  LINK_CREATED: "Link created",
  LINK_OPENED: "Link opened by client",
  ID_UPLOADED: "Client uploaded ID",
  ID_VIEWED: "Agent viewed ID",
  DELETED: "Submission deleted",
  EXPIRED: "Link expired",
};

export function IdUploadViewer({ upload, auditLogs }: Props) {
  const router = useRouter();
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<"front" | "back" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadImage(side: "front" | "back") {
    setLoading(side);
    setError(null);
    try {
      const res = await fetch(`/api/id-uploads/${upload.id}?side=${side}`);
      if (!res.ok) {
        setError("Failed to load image.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (side === "front") setFrontUrl(url);
      else setBackUrl(url);
    } catch {
      setError("Failed to load image.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this ID upload and its link? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/links/${upload.link.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-600 hover:bg-red-50 hover:border-red-300"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Photo ID Upload</h1>
        {upload.clientName && (
          <p className="text-sm text-slate-500 mt-1">{upload.clientName}</p>
        )}
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">ID Images</CardTitle>
            <span className="text-xs text-slate-400">
              Deletes {formatDate(upload.deleteAt)}
            </span>
          </div>
          <CardDescription>
            Uploaded {formatDate(upload.createdAt)}
            {upload.viewCount > 0 && ` · Viewed ${upload.viewCount} time${upload.viewCount > 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Front ID */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Front of ID</p>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/id-uploads/${upload.id}?side=front&download=1`}>
                <Download className="w-4 h-4" />
                Download front
              </a>
            </Button>
            {frontUrl ? (
              <div className="rounded-xl overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frontUrl} alt="ID front" className="w-full object-contain max-h-80 bg-slate-50" />
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => loadImage("front")}
                disabled={loading === "front"}
                className="w-full"
              >
                {loading === "front" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {loading === "front" ? "Loading..." : "View front"}
              </Button>
            )}
          </div>

          {/* Back ID */}
          {upload.hasBack && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Back of ID</p>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/id-uploads/${upload.id}?side=back&download=1`}>
                  <Download className="w-4 h-4" />
                  Download back
                </a>
              </Button>
              {backUrl ? (
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={backUrl} alt="ID back" className="w-full object-contain max-h-80 bg-slate-50" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => loadImage("back")}
                  disabled={loading === "back"}
                  className="w-full"
                >
                  {loading === "back" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {loading === "back" ? "Loading..." : "View back"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Activity log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400">No activity recorded.</p>
          ) : (
            <div>
              {auditLogs.map((log, i) => (
                <div key={log.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-700">
                      {EVENT_LABELS[log.event] ?? log.event}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
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
