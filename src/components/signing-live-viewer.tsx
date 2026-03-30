"use client";

import { useEffect, useState } from "react";

export interface LiveField {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  recipientName: string;
  recipientIndex: number;
}

const COLORS = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
  { bg: "#ede9fe", border: "#8b5cf6", text: "#6d28d9" },
  { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
];

function col(idx: number) {
  return COLORS[idx % COLORS.length];
}

function fmtDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SigningLiveViewer({
  blobUrl,
  fields,
}: {
  blobUrl: string;
  fields: LiveField[];
}) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      setRendering(true);
      setRenderError(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ url: blobUrl }).promise;
        const imgs: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          imgs.push(canvas.toDataURL("image/jpeg", 0.88));
        }
        if (!cancelled) setPageImages(imgs);
      } catch (err) {
        console.error("[live-viewer]", err);
        if (!cancelled) setRenderError("Unable to render document preview.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  if (rendering) {
    return (
      <div
        style={{
          padding: "40px 24px",
          textAlign: "center",
          color: "#64748b",
          fontSize: "13px",
          background: "#e8ecf0",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "2px solid #3b82f6",
            borderTopColor: "transparent",
            animation: "lv-spin 0.7s linear infinite",
            margin: "0 auto 10px",
          }}
        />
        Rendering document…
        <style>{`@keyframes lv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (renderError) {
    return (
      <div
        style={{
          padding: "16px",
          fontSize: "13px",
          color: "#ef4444",
          background: "#e8ecf0",
        }}
      >
        {renderError}
      </div>
    );
  }

  if (pageImages.length === 0) return null;

  // Signature progress legend
  const uniqueRecipients = Array.from(
    new Map(fields.map((f) => [f.recipientIndex, f.recipientName])).entries()
  ).sort(([a], [b]) => a - b);

  return (
    <div style={{ background: "#e8ecf0" }}>
      {/* Legend */}
      {uniqueRecipients.length > 0 && (
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            borderBottom: "1px solid #d1d5db",
          }}
        >
          {uniqueRecipients.map(([idx, name]) => {
            const c = col(idx);
            const recipientFields = fields.filter((f) => f.recipientIndex === idx);
            const signed = recipientFields.filter((f) => !!f.value).length;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  fontSize: "11px",
                  color: c.text,
                  fontWeight: 600,
                }}
              >
                <span>{name}</span>
                <span style={{ opacity: 0.7 }}>
                  {signed}/{recipientFields.length} signed
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pages */}
      <div style={{ padding: "16px" }}>
        {pageImages.map((imgSrc, idx) => {
          const pageNum = idx + 1;
          const pageFields = fields.filter((f) => f.page === pageNum);

          return (
            <div
              key={pageNum}
              style={{
                marginBottom: "12px",
                borderRadius: "6px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                background: "white",
              }}
            >
              <div style={{ position: "relative", lineHeight: 0 }}>
                <img
                  src={imgSrc}
                  alt={`Page ${pageNum}`}
                  style={{ width: "100%", display: "block" }}
                  draggable={false}
                />
                {pageFields.map((field) => {
                  const c = col(field.recipientIndex);
                  const val = field.value ?? "";
                  const isDone = field.type === "CHECKBOX" ? val === "true" : !!val;
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
                        background: isDone
                          ? isImg
                            ? "rgba(255,255,255,0.05)"
                            : c.bg + "cc"
                          : c.bg + "60",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isDone && isImg ? (
                        <img
                          src={val}
                          alt="signed"
                          style={{
                            width: "96%",
                            height: "96%",
                            objectFit: "contain",
                          }}
                        />
                      ) : isDone && field.type === "DATE_SIGNED" ? (
                        <span
                          style={{
                            fontSize: "clamp(7px,1.8vw,11px)",
                            color: c.text,
                            fontWeight: 600,
                            padding: "0 2px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%",
                          }}
                        >
                          {fmtDate(val)}
                        </span>
                      ) : isDone ? (
                        <span
                          style={{
                            fontSize: "clamp(7px,1.8vw,11px)",
                            color: c.text,
                            fontWeight: 600,
                            padding: "0 2px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%",
                          }}
                        >
                          {field.type === "CHECKBOX" ? "✓" : val}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "clamp(5px,1.1vw,8px)",
                            color: c.text,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            opacity: 0.6,
                            textAlign: "center",
                            padding: "1px",
                          }}
                        >
                          {field.type === "SIGNATURE"
                            ? "Sign"
                            : field.type === "INITIALS"
                            ? "Init"
                            : field.type === "DATE_SIGNED"
                            ? "Date"
                            : "Fill"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  padding: "4px 10px",
                  background: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                  fontSize: "10px",
                  color: "#94a3b8",
                }}
              >
                Page {pageNum} of {pageImages.length}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
