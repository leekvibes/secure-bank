"use client";

import { useState, useEffect } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import { isPreviewable, mimeCategory } from "@/lib/transfer-mime";
import { Button } from "@/components/ui/button";

interface Props {
  transferToken: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
  onDownload: (fileId: string) => void;
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; serveUrl: string }
  | { status: "error"; message: string }
  | { status: "unsupported" };

export function TransferPreviewModal({
  transferToken, fileId, fileName, mimeType, onClose, onDownload,
}: Props) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [textContent, setTextContent] = useState<string | null>(null);
  const category = mimeCategory(mimeType);

  useEffect(() => {
    let cancelled = false;

    if (!isPreviewable(mimeType)) {
      setState({ status: "unsupported" });
      return;
    }

    async function fetchSignedUrl() {
      try {
        const res = await fetch(
          `/api/t/${transferToken}/sign?fileId=${fileId}&action=preview`
        );
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          const message =
            (d as { error?: { message?: string } }).error?.message ??
            (d as { message?: string }).message ??
            "Could not load preview.";
          setState({ status: "error", message });
          return;
        }
        const { signedToken } = await res.json() as { signedToken: string };
        const serveUrl = `/api/t/${transferToken}/serve/${encodeURIComponent(signedToken)}`;

        if (category === "text") {
          const textRes = await fetch(serveUrl);
          if (cancelled) return;
          if (!textRes.ok) { setState({ status: "error", message: "Could not load file." }); return; }
          const text = await textRes.text();
          setTextContent(text.slice(0, 20_000));
        }

        if (!cancelled) setState({ status: "ready", serveUrl });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error." });
      }
    }

    fetchSignedUrl();
    return () => { cancelled = true; };
  }, [transferToken, fileId, mimeType, category]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <p className="text-sm font-semibold text-gray-900 truncate pr-4">{fileName}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onDownload(fileId)} className="gap-1.5 h-8">
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-gray-50 min-h-0 flex items-center justify-center p-4">
          {state.status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
              <AlertCircle className="w-7 h-7 text-red-400" />
              <p className="text-sm text-center">{state.message}</p>
              <Button size="sm" variant="outline" onClick={() => onDownload(fileId)}>
                Download instead
              </Button>
            </div>
          )}

          {state.status === "unsupported" && (
            <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
              <AlertCircle className="w-7 h-7" />
              <p className="text-sm font-medium text-gray-600">Preview not available</p>
              <p className="text-xs text-gray-400">Download required to view this file type.</p>
              <Button size="sm" variant="outline" onClick={() => onDownload(fileId)}>
                Download
              </Button>
            </div>
          )}

          {state.status === "ready" && category === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.serveUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          )}

          {state.status === "ready" && category === "video" && (
            <video
              src={state.serveUrl}
              controls
              className="max-w-full max-h-full rounded-lg"
              style={{ maxHeight: "calc(90vh - 140px)" }}
            />
          )}

          {state.status === "ready" && category === "audio" && (
            <div className="w-full max-w-md px-4">
              <p className="text-sm font-medium text-gray-700 mb-4 text-center">{fileName}</p>
              <audio src={state.serveUrl} controls className="w-full" />
            </div>
          )}

          {state.status === "ready" && category === "pdf" && (
            <iframe
              src={state.serveUrl}
              title={fileName}
              className="w-full rounded-lg border border-gray-200"
              style={{ height: "calc(90vh - 140px)" }}
            />
          )}

          {state.status === "ready" && category === "text" && (
            <pre className="w-full h-full overflow-auto text-xs text-gray-700 bg-white rounded-lg border border-gray-200 p-4 font-mono whitespace-pre-wrap break-all">
              {textContent ?? ""}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
