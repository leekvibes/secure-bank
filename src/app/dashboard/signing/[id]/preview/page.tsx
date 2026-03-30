"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { type LiveField } from "@/components/signing-live-viewer";

const COLORS = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
  { bg: "#ede9fe", border: "#8b5cf6", text: "#6d28d9" },
  { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
];

function col(idx: number) { return COLORS[idx % COLORS.length]; }

function fmtDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

interface SigningField {
  id: string; recipientId: string; type: string; page: number;
  x: number; y: number; width: number; height: number; value: string | null;
}

interface Recipient { id: string; name: string; status: string; }

interface RequestData {
  id: string; title: string | null; originalName: string | null;
  status: string; blobUrl: string | null; signedBlobUrl: string | null;
  signingFields: SigningField[]; recipients: Recipient[];
}

export default function PreviewPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [request, setRequest] = useState<RequestData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Fetch request data
  useEffect(() => {
    if (!id) return;
    fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data as { error?: { message?: string } })?.error?.message ?? "Failed to load document.");
        const req = ((data as { request?: RequestData }).request ?? data) as RequestData;
        setRequest(req);
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Failed to load document."));
  }, [id]);

  // Render PDF
  useEffect(() => {
    if (!request) return;
    const url = request.signedBlobUrl ?? request.blobUrl;
    if (!url) return;
    let cancelled = false;
    async function render() {
      setRendering(true);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ url: url! }).promise;
        const imgs: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2.5 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          imgs.push(canvas.toDataURL("image/jpeg", 0.92));
        }
        if (!cancelled) { setPageImages(imgs); pageRefs.current = new Array(imgs.length).fill(null); }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [request]);

  const liveFields = useMemo<LiveField[]>(() => {
    if (!request) return [];
    const recipientMap = new Map(request.recipients.map((r, i) => [r.id, { name: r.name, index: i }]));
    return request.signingFields.map((f) => {
      const rec = recipientMap.get(f.recipientId);
      return { id: f.id, type: f.type, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, value: f.value ?? null, recipientName: rec?.name ?? "Unknown", recipientIndex: rec?.index ?? 0 };
    });
  }, [request]);

  function scrollToPage(n: number) {
    const el = pageRefs.current[n - 1];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(n);
  }

  const totalPages = pageImages.length;
  const title = request?.title?.trim() || request?.originalName || "Document Preview";
  const isCompleted = request?.status === "COMPLETED";

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: "14px" }}>
        {loadError}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1e293b", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "10px 16px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => window.close()}
            style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #334155", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer" }}
          >
            ← Close
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
            <p style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              {isCompleted ? "Completed — Signed Copy" : "In Progress — Live View"}
            </p>
          </div>
          {totalPages > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #334155", background: "transparent", color: currentPage <= 1 ? "#475569" : "#94a3b8", cursor: currentPage <= 1 ? "not-allowed" : "pointer", fontSize: "16px", lineHeight: "1" }}
              >‹</button>
              <span style={{ fontSize: "12px", color: "#94a3b8", minWidth: "60px", textAlign: "center" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #334155", background: "transparent", color: currentPage >= totalPages ? "#475569" : "#94a3b8", cursor: currentPage >= totalPages ? "not-allowed" : "pointer", fontSize: "16px", lineHeight: "1" }}
              >›</button>
            </div>
          )}
          <a
            href={`/api/signing/requests/${encodeURIComponent(id)}/download${isCompleted ? "" : "?type=original"}`}
            download
            style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}
          >
            Download
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {rendering && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#64748b", fontSize: "13px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
              Rendering document…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {!rendering && !request?.blobUrl && !request?.signedBlobUrl && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#64748b", fontSize: "14px" }}>No document available.</div>
          )}
          {pageImages.map((imgSrc, idx) => {
            const pageNum = idx + 1;
            const pageFields = liveFields.filter((f) => f.page === pageNum);
            return (
              <div
                key={pageNum}
                ref={(el) => { pageRefs.current[idx] = el; }}
                style={{ marginBottom: "24px", borderRadius: "4px", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
              >
                <div style={{ position: "relative", lineHeight: 0 }}>
                  <img src={imgSrc} alt={`Page ${pageNum}`} style={{ width: "100%", display: "block" }} draggable={false} />
                  {/* Only show overlays when not the signed PDF */}
                  {!request?.signedBlobUrl && pageFields.map((field) => {
                    const c = col(field.recipientIndex);
                    const val = field.value ?? "";
                    const isDone = !!val;
                    const isImg = val.startsWith("data:image");
                    return (
                      <div
                        key={field.id}
                        title={`${field.recipientName} — ${field.type}`}
                        style={{
                          position: "absolute",
                          left: `${field.x * 100}%`,
                          top: `${field.y * 100}%`,
                          width: `${field.width * 100}%`,
                          height: `${field.height * 100}%`,
                          border: `1.5px solid ${c.border}`,
                          borderRadius: "3px",
                          boxSizing: "border-box",
                          background: isDone ? (isImg ? "rgba(255,255,255,0.05)" : c.bg + "cc") : c.bg + "60",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isDone && isImg ? (
                          <img src={val} alt="signed" style={{ width: "96%", height: "96%", objectFit: "contain" }} />
                        ) : isDone && field.type === "DATE_SIGNED" ? (
                          <span style={{ fontSize: "clamp(8px,1.8vw,12px)", color: c.text, fontWeight: 700, padding: "0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                            {fmtDate(val)}
                          </span>
                        ) : isDone ? (
                          <span style={{ fontSize: "clamp(8px,1.8vw,12px)", color: c.text, fontWeight: 600, padding: "0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                            {field.type === "CHECKBOX" ? "✓" : field.type === "ATTACHMENT" ? "📎" : val}
                          </span>
                        ) : (
                          <span style={{ fontSize: "clamp(5px,1.1vw,9px)", color: c.text, fontWeight: 700, textTransform: "uppercase", opacity: 0.65 }}>
                            {field.type === "SIGNATURE" ? "Sign" : field.type === "INITIALS" ? "Init" : field.type === "DATE_SIGNED" ? "Date" : "Fill"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "4px 12px", background: "#0f172a", fontSize: "11px", color: "#475569" }}>
                  Page {pageNum} of {totalPages}
                </div>
              </div>
            );
          })}
          <div style={{ height: "40px" }} />
        </div>
      </div>
    </div>
  );
}
