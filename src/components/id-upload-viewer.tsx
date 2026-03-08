"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Trash2, Clock, Loader2, Download, Camera, Calendar, Hash, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const EVENT_ICONS: Record<string, { bg: string; color: string }> = {
  LINK_CREATED: { bg: "bg-primary/10", color: "text-primary" },
  LINK_OPENED: { bg: "bg-amber-500/10", color: "text-amber-500" },
  ID_UPLOADED: { bg: "bg-emerald-500/10", color: "text-emerald-500" },
  ID_VIEWED: { bg: "bg-blue-500/10", color: "text-blue-500" },
  DELETED: { bg: "bg-red-500/10", color: "text-red-500" },
  EXPIRED: { bg: "bg-muted/60", color: "text-muted-foreground" },
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
    <div className="max-w-2xl animate-fade-in space-y-6">

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </Link>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border bg-orange-500/10 border-orange-500/20">
            <Camera className="w-6 h-6 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {upload.clientName ?? <span className="text-muted-foreground font-normal italic">Photo ID Upload</span>}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 bg-orange-500/10 text-orange-600 ring-orange-500/20">
                <Camera className="w-3 h-3" />
                ID Upload
              </span>
            </div>
            {upload.clientName && (
              <p className="text-sm text-muted-foreground mt-0.5">Photo ID Upload</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl text-red-500 hover:bg-red-500/10 hover:border-red-500/30 shrink-0"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </Button>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            Uploaded {formatDate(upload.createdAt)}
          </div>
          {upload.viewCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              Viewed {upload.viewCount} time{upload.viewCount > 1 ? "s" : ""}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Hash className="w-3.5 h-3.5" />
            {upload.hasBack ? "Front & Back" : "Front only"}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-6 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          ID Images
        </h2>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Front of ID</p>
              <Button variant="outline" size="sm" asChild className="rounded-xl">
                <a href={`/api/id-uploads/${upload.id}?side=front&download=1`}>
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </Button>
            </div>
            {frontUrl ? (
              <div className="rounded-xl overflow-hidden border border-border/40 ring-1 ring-border/20 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frontUrl} alt="ID front" className="w-full object-contain max-h-80 bg-surface-2" />
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => loadImage("front")}
                disabled={loading === "front"}
                className="w-full rounded-xl h-11 border-dashed hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                {loading === "front" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {loading === "front" ? "Decrypting..." : "View front"}
              </Button>
            )}
          </div>

          {upload.hasBack && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Back of ID</p>
                <Button variant="outline" size="sm" asChild className="rounded-xl">
                  <a href={`/api/id-uploads/${upload.id}?side=back&download=1`}>
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </Button>
              </div>
              {backUrl ? (
                <div className="rounded-xl overflow-hidden border border-border/40 ring-1 ring-border/20 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={backUrl} alt="ID back" className="w-full object-contain max-h-80 bg-surface-2" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => loadImage("back")}
                  disabled={loading === "back"}
                  className="w-full rounded-xl h-11 border-dashed hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  {loading === "back" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {loading === "back" ? "Decrypting..." : "View back"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-6 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Activity timeline
        </h2>

        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <div>
            {auditLogs.map((log, i) => {
              const eventStyle = EVENT_ICONS[log.event] ?? { bg: "bg-muted/60", color: "text-muted-foreground" };
              return (
                <div key={log.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${eventStyle.bg}`}>
                      <Clock className={`w-3.5 h-3.5 ${eventStyle.color}`} />
                    </div>
                    {i < auditLogs.length - 1 && (
                      <div className="w-px flex-1 min-h-[20px] bg-border my-1" />
                    )}
                  </div>
                  <div className={i < auditLogs.length - 1 ? "pb-5" : "pb-0"}>
                    <p className="text-sm font-semibold text-foreground mt-1.5 leading-none">
                      {EVENT_LABELS[log.event] ?? log.event}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1 tabular-nums">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
