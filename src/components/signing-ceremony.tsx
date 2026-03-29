"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import SignaturePad from "signature_pad";

// ── Types ────────────────────────────────────────────────────────────────────

interface Field {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  options: string[] | null;
}

interface DocData {
  _flow: "new";
  recipient: { id: string; name: string; email: string; status: string; order: number };
  request: {
    id: string;
    title: string | null;
    message: string | null;
    blobUrl: string | null;
    documentHash: string | null;
    expiresAt: string;
    signingMode: string;
  };
  agent: { displayName: string; agencyName: string | null };
  pages: { page: number; widthPts: number; heightPts: number }[];
  fields: Field[];
  totalRecipients: number;
  completedCount: number;
}

type Screen = "loading" | "error" | "consent" | "signing" | "decline-form" | "complete";
type SigMode = "type" | "draw" | "upload";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtExpiry(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    // Parse as local date to avoid UTC-midnight timezone offset issues
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

function todayLocalISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function fieldTagLabel(type: string): string {
  const map: Record<string, string> = {
    SIGNATURE: "Sign Here",
    INITIALS: "Initial",
    DATE_SIGNED: "Date",
    FULL_NAME: "Full Name",
    TITLE: "Title",
    COMPANY: "Company",
    TEXT: "Text",
    CHECKBOX: "Check",
    RADIO: "Select",
    DROPDOWN: "Select",
    ATTACHMENT: "File",
  };
  return map[type] ?? type;
}

function fieldModalTitle(type: string): string {
  const map: Record<string, string> = {
    SIGNATURE: "Add Your Signature",
    INITIALS: "Add Your Initials",
    DATE_SIGNED: "Date Signed",
    FULL_NAME: "Full Name",
    TITLE: "Title",
    COMPANY: "Company",
    TEXT: "Text Field",
    CHECKBOX: "Checkbox",
    RADIO: "Selection",
    DROPDOWN: "Dropdown",
  };
  return map[type] ?? "Fill Field";
}

function fieldColor(type: string) {
  switch (type) {
    case "SIGNATURE":  return { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" };
    case "INITIALS":   return { bg: "#ede9fe", border: "#8b5cf6", text: "#6d28d9" };
    case "DATE_SIGNED":return { bg: "#d1fae5", border: "#10b981", text: "#065f46" };
    case "FULL_NAME":  return { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" };
    case "CHECKBOX":   return { bg: "#f0f9ff", border: "#0ea5e9", text: "#0369a1" };
    default:           return { bg: "#f1f5f9", border: "#94a3b8", text: "#475569" };
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isFieldDone(field: Field, value: string): boolean {
  if (!field.required) return !!value;
  if (!value) return false;
  if (field.type === "SIGNATURE" || field.type === "INITIALS") {
    return value.startsWith("data:image") && value.length > 200;
  }
  if (field.type === "CHECKBOX") return true;
  return value.trim().length > 0;
}

function requiredAllDone(fields: Field[], values: Record<string, string>): boolean {
  return fields.filter((f) => f.required).every((f) => isFieldDone(f, values[f.id] ?? ""));
}

// ── Load Google Font once ─────────────────────────────────────────────────────

let fontLoaded = false;
function ensureSigFont() {
  if (fontLoaded || typeof document === "undefined") return;
  fontLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap";
  document.head.appendChild(link);
}

function renderTypedSig(text: string, width = 360, height = 90): string {
  if (!text.trim() || typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  const s = 2;
  c.width = width * s;
  c.height = height * s;
  const ctx = c.getContext("2d")!;
  ctx.scale(s, s);
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${Math.round(height * 0.62)}px "Dancing Script", "Brush Script MT", cursive`;
  ctx.fillStyle = "#001ea0";
  ctx.fillText(text, 8, height * 0.76);
  return c.toDataURL("image/png");
}

function renderTypedInitials(text: string): string {
  if (!text.trim() || typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  const s = 2;
  const sz = 80;
  c.width = sz * s;
  c.height = sz * s;
  const ctx = c.getContext("2d")!;
  ctx.scale(s, s);
  ctx.clearRect(0, 0, sz, sz);
  ctx.font = `bold ${Math.round(sz * 0.6)}px "Dancing Script", "Brush Script MT", cursive`;
  ctx.fillStyle = "#001ea0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, sz / 2, sz / 2);
  return c.toDataURL("image/png");
}

// ── Draw Tab (isolated component so pad init/cleanup is tied to mount) ────────

function DrawTab({ onReady }: { onReady: (getPng: () => string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, {
      minWidth: 1.5,
      maxWidth: 3.5,
      penColor: "rgb(0, 30, 160)",
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;
    onReady(() => (pad.isEmpty() ? null : pad.toDataURL("image/png")));

    const resize = () => {
      const r = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * r;
      canvas.height = canvas.offsetHeight * r;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(r, r);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => {
      ro.disconnect();
      pad.off();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          background: "#f8fafc",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "160px", touchAction: "none", cursor: "crosshair" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            opacity: 0.35,
          }}
        >
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>Draw here</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => padRef.current?.clear()}
        style={{
          marginTop: "8px",
          fontSize: "12px",
          color: "#64748b",
          textDecoration: "underline",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Clear
      </button>
    </div>
  );
}

// ── Signature / Initials Modal ────────────────────────────────────────────────

function SigModal({
  recipientName,
  mode,
  onConfirm,
  onClose,
}: {
  recipientName: string;
  mode: "signature" | "initials";
  onConfirm: (url: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SigMode>("type");
  const [typedText, setTypedText] = useState(
    mode === "initials" ? getInitials(recipientName) : recipientName
  );
  const [typedPreview, setTypedPreview] = useState("");
  const [uploadPreview, setUploadPreview] = useState("");
  const getDrawPngRef = useRef<(() => string | null) | null>(null);

  useEffect(() => { ensureSigFont(); }, []);

  useEffect(() => {
    if (tab !== "type") return;
    const t = setTimeout(() => {
      setTypedPreview(
        mode === "initials" ? renderTypedInitials(typedText) : renderTypedSig(typedText)
      );
    }, 80);
    return () => clearTimeout(t);
  }, [typedText, tab, mode]);

  const handleConfirm = () => {
    if (tab === "type") {
      const url = mode === "initials" ? renderTypedInitials(typedText) : renderTypedSig(typedText);
      if (url) onConfirm(url);
    } else if (tab === "draw") {
      const url = getDrawPngRef.current?.();
      if (url) onConfirm(url);
    } else if (tab === "upload") {
      if (uploadPreview) onConfirm(uploadPreview);
    }
  };

  const canConfirm =
    tab === "type"
      ? typedText.trim().length > 0
      : tab === "draw"
      ? true
      : !!uploadPreview;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "20px 20px 32px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "4px",
            background: "#e2e8f0",
            borderRadius: "2px",
            margin: "0 auto 18px",
          }}
        />

        <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "18px", color: "#0f172a" }}>
          {mode === "signature" ? "Add Your Signature" : "Add Your Initials"}
        </h2>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          {(["type", "draw", "upload"] as SigMode[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "9px 4px",
                borderRadius: "8px",
                border: `2px solid ${tab === t ? "#3b82f6" : "#e2e8f0"}`,
                background: tab === t ? "#eff6ff" : "transparent",
                color: tab === t ? "#1d4ed8" : "#64748b",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t === "type" ? "Type" : t === "draw" ? "Draw" : "Upload"}
            </button>
          ))}
        </div>

        {/* Type tab */}
        {tab === "type" && (
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              {mode === "initials" ? "Initials" : "Full name"}
            </label>
            <input
              autoFocus
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={mode === "initials" ? "e.g. JS" : "Your full name…"}
              style={{
                width: "100%",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "15px",
                boxSizing: "border-box",
                marginBottom: "14px",
                outline: "none",
              }}
            />
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                background: "#f8fafc",
                padding: "16px",
                minHeight: "96px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "6px",
              }}
            >
              {typedPreview ? (
                <img
                  src={typedPreview}
                  alt="preview"
                  style={{ maxWidth: "100%", maxHeight: "80px" }}
                />
              ) : (
                <span style={{ color: "#cbd5e1", fontSize: "13px" }}>Preview appears here</span>
              )}
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
              Signature will render in cursive style
            </p>
          </div>
        )}

        {/* Draw tab */}
        {tab === "draw" && (
          <DrawTab onReady={(fn) => { getDrawPngRef.current = fn; }} />
        )}

        {/* Upload tab */}
        {tab === "upload" && (
          <label
            style={{
              display: "block",
              border: `2px dashed ${uploadPreview ? "#10b981" : "#e2e8f0"}`,
              borderRadius: "10px",
              padding: uploadPreview ? "12px" : "32px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: "4px",
              transition: "border-color 0.2s",
            }}
          >
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setUploadPreview((ev.target?.result as string) ?? "");
                reader.readAsDataURL(file);
              }}
            />
            {uploadPreview ? (
              <img
                src={uploadPreview}
                alt="Uploaded signature"
                style={{ maxHeight: "100px", maxWidth: "100%", display: "block", margin: "0 auto" }}
              />
            ) : (
              <>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🖼️</div>
                <p style={{ fontSize: "14px", color: "#475569", marginBottom: "4px" }}>
                  Tap to choose an image
                </p>
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>PNG, JPG supported</p>
              </>
            )}
          </label>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "white",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              color: "#374151",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: canConfirm
                ? "linear-gradient(135deg, #00A3FF, #0057FF)"
                : "#e2e8f0",
              color: canConfirm ? "white" : "#94a3b8",
              fontSize: "14px",
              fontWeight: 700,
              cursor: canConfirm ? "pointer" : "not-allowed",
              boxShadow: canConfirm ? "0 4px 12px rgba(0,87,255,0.25)" : "none",
            }}
          >
            {mode === "signature" ? "Apply Signature" : "Apply Initials"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generic Field Modal ───────────────────────────────────────────────────────

function FieldModal({
  field,
  recipientName,
  currentValue,
  onConfirm,
  onClose,
}: {
  field: Field;
  recipientName: string;
  currentValue: string;
  onConfirm: (val: string) => void;
  onClose: () => void;
}) {
  const defaultVal =
    currentValue ||
    (field.type === "DATE_SIGNED" ? new Date().toISOString().slice(0, 10) :
     field.type === "FULL_NAME"   ? recipientName : "");

  const [val, setVal] = useState(defaultVal);

  const isReady = field.type === "CHECKBOX" ? true : !!val.trim();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxWidth: "560px",
          padding: "20px 20px 32px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "4px",
            background: "#e2e8f0",
            borderRadius: "2px",
            margin: "0 auto 18px",
          }}
        />
        <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "18px", color: "#0f172a" }}>
          {fieldModalTitle(field.type)}
        </h2>

        {field.type === "DATE_SIGNED" && (
          <input
            type="date"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "16px",
              boxSizing: "border-box",
              marginBottom: "20px",
              outline: "none",
            }}
          />
        )}

        {(field.type === "FULL_NAME" ||
          field.type === "TEXT" ||
          field.type === "TITLE" ||
          field.type === "COMPANY") && (
          <input
            autoFocus
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`Enter ${fieldModalTitle(field.type).toLowerCase()}…`}
            style={{
              width: "100%",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "16px",
              boxSizing: "border-box",
              marginBottom: "20px",
              outline: "none",
            }}
          />
        )}

        {field.type === "CHECKBOX" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
              marginBottom: "24px",
              userSelect: "none",
            }}
            onClick={() => setVal(val === "true" ? "false" : "true")}
          >
            <div
              style={{
                width: "26px",
                height: "26px",
                border: "2px solid #3b82f6",
                borderRadius: "6px",
                background: val === "true" ? "#3b82f6" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              {val === "true" && (
                <svg viewBox="0 0 12 10" width="13" height="11" fill="none">
                  <path
                    d="M1 5l3.5 3.5L11 1"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span style={{ fontSize: "15px", color: "#374151" }}>
              {val === "true" ? "Checked ✓" : "Tap to check"}
            </span>
          </div>
        )}

        {field.type === "DROPDOWN" && field.options && (
          <select
            value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "16px",
              boxSizing: "border-box",
              marginBottom: "20px",
              background: "white",
              outline: "none",
            }}
          >
            <option value="">Select an option…</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {field.type === "RADIO" && field.options && (
          <div style={{ marginBottom: "20px" }}>
            {field.options.map((opt) => (
              <label
                key={opt}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  marginBottom: "14px",
                }}
              >
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={val === opt}
                  onChange={() => setVal(opt)}
                  style={{ accentColor: "#3b82f6", width: "18px", height: "18px" }}
                />
                <span style={{ fontSize: "15px", color: "#374151" }}>{opt}</span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "white",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              color: "#374151",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(val)}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: isReady
                ? "linear-gradient(135deg, #00A3FF, #0057FF)"
                : "#e2e8f0",
              color: isReady ? "white" : "#94a3b8",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: isReady ? "0 4px 12px rgba(0,87,255,0.2)" : "none",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Signing Ceremony ─────────────────────────────────────────────────────

export function SigningCeremony({
  token,
  initialData,
}: {
  token: string;
  // Pre-fetched data passed from SigningRouter — avoids a redundant second API call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any> | null;
}) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [data, setData] = useState<DocData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  // "signed" | "declined" | null — tracks how the user exited the signing flow
  const [completionType, setCompletionType] = useState<"signed" | "declined" | null>(null);
  const [completionData, setCompletionData] = useState<{
    certUrl?: string;
    signedBlobUrl?: string;
  }>({});

  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Helper: process raw API response data into component state
  const applyDocData = useCallback((json: Record<string, unknown>) => {
    const d = json as unknown as DocData;
    const prefill: Record<string, string> = {};
    for (const f of d.fields) {
      if (f.type === "DATE_SIGNED") prefill[f.id] = todayLocalISO();
      else if (f.type === "FULL_NAME") prefill[f.id] = d.recipient.name;
    }
    setFieldValues(prefill);
    setData(d);
    setScreen("consent");
  }, []);

  // ── Load signing data ────────────────────────────────────────────────────
  // If the router pre-fetched the data, use it directly (no second request).
  // Otherwise (e.g. direct navigation), fetch it ourselves.
  useEffect(() => {
    if (initialData) {
      applyDocData(initialData);
      return;
    }
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({})) as Record<string, unknown>;
        if (!r.ok) {
          setErrorMsg(
            (json?.error as { message?: string } | undefined)?.message ??
              "This signing link is not available."
          );
          setScreen("error");
          return;
        }
        if (json._flow !== "new") {
          setErrorMsg("Unexpected signing flow.");
          setScreen("error");
          return;
        }
        applyDocData(json);
      })
      .catch(() => {
        setErrorMsg("Unable to load signing request. Please check your connection.");
        setScreen("error");
      });
  }, [token, initialData, applyDocData]);

  // ── Render PDF pages ─────────────────────────────────────────────────────
  const renderPdf = useCallback(async (blobUrl: string) => {
    setPdfRendering(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ url: blobUrl }).promise;
      const imgs: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        imgs.push(canvas.toDataURL("image/jpeg", 0.88));
      }
      setPageImages(imgs);
    } catch (err) {
      console.error("[signing-ceremony] PDF render failed:", err);
    } finally {
      setPdfRendering(false);
    }
  }, []);

  // ── Consent → Signing ────────────────────────────────────────────────────
  const sendConsent = useCallback(async () => {
    try {
      const res = await fetch(`/api/sign/${token}/consent`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
        const msg = json?.error?.message;
        // Only block on hard errors (voided/expired); ignore idempotent "already" errors
        if (msg && res.status !== 409) {
          setErrorMsg(msg);
          setScreen("error");
          return;
        }
      }
    } catch { /* non-critical — proceed to signing */ }
    if (data?.request.blobUrl) renderPdf(data.request.blobUrl);
    setScreen("signing");
  }, [token, data, renderPdf]);

  // ── Field helpers ────────────────────────────────────────────────────────
  const setFieldValue = useCallback((id: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  const activeField = activeFieldId && data
    ? data.fields.find((f) => f.id === activeFieldId) ?? null
    : null;

  const nextIncompleteField = data?.fields.find(
    (f) => f.required && !isFieldDone(f, fieldValues[f.id] ?? "")
  ) ?? null;

  const scrollToField = (fieldId: string) => {
    fieldRefs.current[fieldId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Auto-place INITIALS and DATE_SIGNED without opening a modal
  const handleFieldClick = useCallback(
    (field: Field) => {
      if (field.type === "INITIALS") {
        ensureSigFont();
        const initials = getInitials(data?.recipient.name ?? "");
        const url = renderTypedInitials(initials);
        if (url) setFieldValue(field.id, url);
        return;
      }
      if (field.type === "DATE_SIGNED") {
        // If already filled, open modal to let them change it; otherwise auto-fill today
        if (!fieldValues[field.id]) {
          setFieldValue(field.id, todayLocalISO());
          return;
        }
        setActiveFieldId(field.id);
        return;
      }
      setActiveFieldId(field.id);
    },
    [data, fieldValues, setFieldValue]
  );

  // ── Submit ───────────────────────────────────────────────────────────────
  const submitSigning = useCallback(async () => {
    if (!data) return;
    setSubmitting(true);
    try {
      const fields = data.fields.map((f) => ({
        id: f.id,
        value: fieldValues[f.id] ?? "",
      }));
      const res = await fetch(`/api/sign/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(
          (json as { error?: { message?: string } }).error?.message ??
            "Submission failed. Please try again."
        );
        setScreen("error");
        return;
      }
      setCompletionData({
        certUrl: (json as { certUrl?: string }).certUrl,
        signedBlobUrl: (json as { signedBlobUrl?: string }).signedBlobUrl,
      });
      setCompletionType("signed");
      setScreen("complete");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setScreen("error");
    } finally {
      setSubmitting(false);
    }
  }, [data, token, fieldValues]);

  const submitDecline = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      setCompletionData({});
      setCompletionType("declined");
      setScreen("complete");
    } finally {
      setSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // Screens
  // ════════════════════════════════════════════════════════════════════════

  if (screen === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "2.5px solid #3b82f6",
            borderTopColor: "transparent",
            animation: "sc-spin 0.7s linear infinite",
          }}
        />
        <p style={{ fontSize: "14px", color: "#64748b" }}>Loading signing request…</p>
        <style>{`@keyframes sc-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", textAlign: "center", color: "#0f172a" }}>
          Unable to load document
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
          {errorMsg}
        </p>
      </div>
    );
  }

  if (!data) return null;

  // ── Consent ──────────────────────────────────────────────────────────────
  if (screen === "consent") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            maxWidth: "480px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ marginBottom: "28px", textAlign: "center" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--foreground)" }}>
              Secure<span style={{ color: "#3b82f6" }}>Link</span>
            </span>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "4px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Electronic Signing
            </p>
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "28px 24px",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: "15px", color: "var(--foreground)", marginBottom: "2px" }}>
                  Electronic Consent
                </h2>
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>Required before signing</p>
              </div>
            </div>

            <div style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.65, marginBottom: "20px" }}>
              <p style={{ marginBottom: "10px" }}>
                By clicking <strong style={{ color: "var(--foreground)" }}>Agree & Continue</strong>, you agree to sign{" "}
                <strong style={{ color: "var(--foreground)" }}>{data.request.title ?? "this document"}</strong> electronically.
              </p>
              <p style={{ marginBottom: "10px" }}>
                Your electronic signature has the same legal effect as a handwritten signature under the{" "}
                <strong style={{ color: "var(--foreground)" }}>ESIGN Act</strong> and the{" "}
                <strong style={{ color: "var(--foreground)" }}>UETA</strong>.
              </p>
              <p>
                Your IP address, browser information, and the exact time of signing will be captured as part of the audit trail.
              </p>
            </div>

            <div
              style={{
                background: "var(--muted)",
                borderRadius: "8px",
                padding: "11px 14px",
                marginBottom: "18px",
                fontSize: "12px",
                color: "var(--muted-foreground)",
              }}
            >
              Requested by{" "}
              <strong style={{ color: "var(--foreground)" }}>{data.agent.displayName}</strong>
              {data.agent.agencyName && ` · ${data.agent.agencyName}`}
              {" · "}Expires {fmtExpiry(data.request.expiresAt)}
            </div>

            <button
              onClick={sendConsent}
              style={{
                width: "100%",
                borderRadius: "12px",
                padding: "13px",
                fontWeight: 700,
                fontSize: "14px",
                color: "white",
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(135deg, #00A3FF, #0057FF)",
                boxShadow: "0 4px 14px rgba(0,87,255,0.28)",
              }}
            >
              Agree & Continue →
            </button>

            <p style={{ textAlign: "center", fontSize: "12px", marginTop: "12px", color: "var(--muted-foreground)" }}>
              You may{" "}
              <button
                onClick={() => setScreen("decline-form")}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "inherit",
                  padding: 0,
                }}
              >
                decline to sign
              </button>{" "}
              if you do not wish to proceed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Decline form ──────────────────────────────────────────────────────────
  if (screen === "decline-form") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--background)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "28px",
            width: "100%",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--foreground)", marginBottom: "8px" }}>
            Decline to sign?
          </h2>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginBottom: "20px", lineHeight: 1.65 }}>
            If you decline, the document will be voided and{" "}
            <strong style={{ color: "var(--foreground)" }}>{data.agent.displayName}</strong> will be notified. This
            cannot be undone.
          </p>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "6px",
            }}
          >
            Reason (optional)
          </label>
          <textarea
            rows={3}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Let the sender know why you're declining…"
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "14px",
              background: "var(--background)",
              color: "var(--foreground)",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "20px",
            }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setScreen("consent")}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--foreground)",
              }}
            >
              Go back
            </button>
            <button
              onClick={submitDecline}
              disabled={submitting}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: "10px",
                border: "none",
                background: "#ef4444",
                color: "white",
                fontSize: "14px",
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Declining…" : "Confirm Decline"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Complete screen ───────────────────────────────────────────────────────
  if (screen === "complete") {
    // Use the explicit completionType flag — never infer decline from missing URLs
    // (not-all-signed responses also have no URLs but the signer DID successfully sign)
    const didDecline = completionType === "declined";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--background)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "24px",
              background: didDecline
                ? "#fee2e2"
                : "linear-gradient(135deg, #d1fae5, #bbf7d0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            {didDecline ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>

          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--foreground)", marginBottom: "8px" }}>
            {didDecline ? "Signing Declined" : "Document Submitted Securely"}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--muted-foreground)",
              lineHeight: 1.65,
              marginBottom: "16px",
              maxWidth: "320px",
              margin: "0 auto 16px",
            }}
          >
            {didDecline
              ? `You have declined to sign${data.request.title ? ` "${data.request.title}"` : ""}. The sender has been notified.`
              : `Your signature has been securely recorded${data.request.title ? ` for "${data.request.title}"` : ""}. A confirmation will be sent to ${data.recipient.email}.`}
          </p>

          {/* Show pending signers message if others still need to sign */}
          {!didDecline && data.totalRecipients > 1 && !completionData.signedBlobUrl && (
            <div
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "20px",
                fontSize: "13px",
                color: "#0369a1",
                maxWidth: "320px",
                margin: "0 auto 20px",
                textAlign: "left",
              }}
            >
              <strong>Your signature has been recorded.</strong> The document will be finalized once all {data.totalRecipients} parties have signed. The sender will be notified automatically.
            </div>
          )}

          {!didDecline && (completionData.signedBlobUrl || completionData.certUrl) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxWidth: "320px",
                margin: "0 auto",
              }}
            >
              {completionData.signedBlobUrl && (
                <a
                  href={completionData.signedBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    borderRadius: "12px",
                    padding: "13px",
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "white",
                    textDecoration: "none",
                    background: "linear-gradient(135deg, #00A3FF, #0057FF)",
                    boxShadow: "0 4px 14px rgba(0,87,255,0.25)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Signed Copy
                </a>
              )}
              {completionData.certUrl && (
                <a
                  href={completionData.certUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    borderRadius: "12px",
                    padding: "13px",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "var(--foreground)",
                    textDecoration: "none",
                    border: "1px solid var(--border)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                  Certificate of Completion
                </a>
              )}
            </div>
          )}

          <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "28px" }}>
            You can safely close this window.
          </p>
        </div>
      </div>
    );
  }

  // ── Signing screen (DocuSign-style PDF + field overlays) ─────────────────
  if (screen === "signing") {
    const reqFields = data.fields.filter((f) => f.required);
    const doneCount = reqFields.filter((f) => isFieldDone(f, fieldValues[f.id] ?? "")).length;
    const canSubmit = requiredAllDone(data.fields, fieldValues);
    const progressPct = reqFields.length > 0 ? (doneCount / reqFields.length) * 100 : 100;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#e8ecf0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            padding: "10px 16px 0",
          }}
        >
          <div style={{ maxWidth: "840px", margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: "8px",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", lineHeight: 1.3 }}>
                  {data.request.title ?? "Document Signing"}
                </p>
                <p style={{ fontSize: "11px", color: "#64748b" }}>
                  {data.agent.displayName}
                  {data.agent.agencyName && ` · ${data.agent.agencyName}`}
                </p>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "99px",
                  background: canSubmit ? "#dcfce7" : "#fef9c3",
                  color: canSubmit ? "#15803d" : "#92400e",
                  whiteSpace: "nowrap",
                }}
              >
                {canSubmit ? "✓ Ready" : `${doneCount} / ${reqFields.length} required`}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: "3px", background: "#e2e8f0", borderRadius: "2px", marginBottom: "0" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #00A3FF, #0057FF)",
                  borderRadius: "2px",
                  transition: "width 0.35s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable PDF area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
          }}
        >
          <div style={{ maxWidth: "840px", margin: "0 auto" }}>
            {/* PDF rendering spinner */}
            {pdfRendering && (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "2.5px solid #3b82f6",
                    borderTopColor: "transparent",
                    animation: "sc-spin 0.7s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                Rendering document…
              </div>
            )}

            {/* No PDF / fallback */}
            {!pdfRendering && pageImages.length === 0 && (
              <div
                style={{
                  background: "white",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                {data.request.blobUrl && (
                  <a
                    href={data.request.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "#3b82f6",
                      textDecoration: "none",
                      marginBottom: "20px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    View full document
                  </a>
                )}
                <p
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    marginBottom: "20px",
                  }}
                >
                  Click each field below to fill it in.
                </p>
                {data.fields.map((field) => {
                  const val = fieldValues[field.id] ?? "";
                  const done = isFieldDone(field, val);
                  const colors = fieldColor(field.type);
                  return (
                    <div
                      key={field.id}
                      ref={(el) => { fieldRefs.current[field.id] = el; }}
                      onClick={() => handleFieldClick(field)}
                      style={{
                        border: `1.5px solid ${done ? colors.border : "#e2e8f0"}`,
                        borderRadius: "10px",
                        padding: "14px 16px",
                        marginBottom: "10px",
                        cursor: "pointer",
                        background: done ? colors.bg + "60" : "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "13px", color: colors.text, marginBottom: "2px" }}>
                          {fieldTagLabel(field.type)}
                          {field.required && !done && (
                            <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>
                          )}
                        </p>
                        {val && !val.startsWith("data:image") && (
                          <p style={{ fontSize: "12px", color: "#64748b" }}>{val}</p>
                        )}
                        {val && val.startsWith("data:image") && (
                          <p style={{ fontSize: "12px", color: "#10b981" }}>✓ Captured</p>
                        )}
                      </div>
                      {done ? (
                        <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 12 10" fill="none">
                            <path d="M1 5l3.5 3.5L11 1" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: colors.bg,
                            color: colors.text,
                            flexShrink: 0,
                          }}
                        >
                          Tap to fill
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* PDF pages with field overlays */}
            {!pdfRendering &&
              pageImages.map((imgSrc, idx) => {
                const pageNum = idx + 1;
                const fieldsOnPage = data.fields.filter((f) => f.page === pageNum);

                return (
                  <div
                    key={pageNum}
                    style={{
                      marginBottom: "16px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                      background: "white",
                    }}
                  >
                    {/* Page with overlaid field tags */}
                    <div style={{ position: "relative", lineHeight: 0 }}>
                      <img
                        src={imgSrc}
                        alt={`Page ${pageNum}`}
                        style={{ width: "100%", display: "block" }}
                        draggable={false}
                      />

                      {fieldsOnPage.map((field) => {
                        const val = fieldValues[field.id] ?? "";
                        const done = isFieldDone(field, val);
                        const isNext = nextIncompleteField?.id === field.id;
                        const colors = fieldColor(field.type);
                        const isImg = val.startsWith("data:image");

                        return (
                          <div
                            key={field.id}
                            ref={(el) => { fieldRefs.current[field.id] = el; }}
                            onClick={() => handleFieldClick(field)}
                            title={fieldTagLabel(field.type)}
                            style={{
                              position: "absolute",
                              left: `${field.x * 100}%`,
                              top: `${field.y * 100}%`,
                              width: `${field.width * 100}%`,
                              height: `${field.height * 100}%`,
                              cursor: "pointer",
                              border: `${isNext && !done ? "2px" : "1.5px"} solid ${colors.border}`,
                              borderRadius: "3px",
                              boxSizing: "border-box",
                              background: done ? (isImg ? "rgba(255,255,255,0.05)" : colors.bg + "cc") : colors.bg + "cc",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              animation: isNext && !done ? "sc-pulse 1.6s ease-in-out infinite" : "none",
                              transition: "border-color 0.2s, background 0.2s",
                            }}
                          >
                            {done && isImg ? (
                              <img
                                src={val}
                                alt="field"
                                style={{
                                  width: "96%",
                                  height: "96%",
                                  objectFit: "contain",
                                }}
                              />
                            ) : done && field.type === "DATE_SIGNED" ? (
                              <span
                                style={{
                                  fontSize: "clamp(7px, 1.8vw, 12px)",
                                  color: colors.text,
                                  fontWeight: 600,
                                  padding: "0 3px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: "100%",
                                }}
                              >
                                {fmtDate(val)}
                              </span>
                            ) : done ? (
                              <span
                                style={{
                                  fontSize: "clamp(7px, 1.8vw, 12px)",
                                  color: colors.text,
                                  fontWeight: 600,
                                  padding: "0 3px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: "100%",
                                }}
                              >
                                {field.type === "CHECKBOX" ? "✓" : val}
                              </span>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "1px",
                                  pointerEvents: "none",
                                  width: "100%",
                                  padding: "2px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "clamp(6px, 1.4vw, 10px)",
                                    color: colors.text,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    lineHeight: 1,
                                    textAlign: "center",
                                  }}
                                >
                                  {fieldTagLabel(field.type)}
                                </span>
                                {field.required && (
                                  <span
                                    style={{
                                      fontSize: "clamp(5px, 1vw, 8px)",
                                      color: colors.border,
                                      fontWeight: 700,
                                    }}
                                  >
                                    ★
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Page footer */}
                    <div
                      style={{
                        padding: "5px 12px",
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

            {/* Bottom spacer so content isn't hidden behind sticky bar */}
            <div style={{ height: "80px" }} />
          </div>
        </div>

        {/* Sticky bottom action bar */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "white",
            borderTop: "1px solid #e2e8f0",
            padding: "10px 16px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: "840px",
              margin: "0 auto",
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setScreen("decline-form")}
              style={{
                flexShrink: 0,
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "white",
                fontSize: "13px",
                fontWeight: 600,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Decline
            </button>

            {canSubmit ? (
              <button
                onClick={submitSigning}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: submitting ? "#94a3b8" : "linear-gradient(135deg, #00A3FF, #0057FF)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: submitting ? "none" : "0 4px 14px rgba(0,87,255,0.3)",
                  transition: "all 0.2s",
                }}
              >
                {submitting ? "Submitting…" : "Finish & Submit →"}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (nextIncompleteField) {
                    scrollToField(nextIncompleteField.id);
                    setActiveFieldId(nextIncompleteField.id);
                  }
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #00A3FF, #0057FF)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(0,87,255,0.3)",
                }}
              >
                {nextIncompleteField ? "Next Required Field →" : "Review & Submit →"}
              </button>
            )}
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes sc-spin { to { transform: rotate(360deg); } }
          @keyframes sc-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(59,130,246,0.4); } 50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(59,130,246,0); } }
        `}</style>

        {/* Field modal */}
        {activeField && (() => {
          if (activeField.type === "SIGNATURE") {
            return (
              <SigModal
                recipientName={data.recipient.name}
                mode="signature"
                onConfirm={(url) => {
                  setFieldValue(activeField.id, url);
                  setActiveFieldId(null);
                }}
                onClose={() => setActiveFieldId(null)}
              />
            );
          }
          return (
            <FieldModal
              field={activeField}
              recipientName={data.recipient.name}
              currentValue={fieldValues[activeField.id] ?? ""}
              onConfirm={(val) => {
                setFieldValue(activeField.id, val);
                setActiveFieldId(null);
              }}
              onClose={() => setActiveFieldId(null)}
            />
          );
        })()}
      </div>
    );
  }

  return null;
}
