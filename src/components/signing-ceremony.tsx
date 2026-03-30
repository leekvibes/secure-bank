"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import SignaturePad from "signature_pad";
import { CONSENT_TEXT_V1 } from "@/lib/signing/consent-text";
import {
  DECLINE_REASON_LABELS,
  DECLINE_REASON_OPTIONS,
  type DeclineReasonCode,
} from "@/lib/signing/decline-reasons";

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
    authLevel: string | null;
  };
  agent: { displayName: string; agencyName: string | null; company?: string | null; logoUrl?: string | null; photoUrl?: string | null };
  pages: { page: number; widthPts: number; heightPts: number }[];
  fields: Field[];
  totalRecipients: number;
  completedCount: number;
}

type Screen = "loading" | "error" | "otp-required" | "otp-verify" | "consent" | "signing" | "decline-form" | "complete";
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
    ATTACHMENT: "Upload Document",
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
  if (field.type === "ATTACHMENT") {
    if (value.startsWith("data:") && value.length > 100) return true;
    try { const p = JSON.parse(value) as { url?: unknown }; return typeof p.url === "string" && p.url.length > 0; } catch { return false; }
  }
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
  token,
  onConfirm,
  onClose,
}: {
  field: Field;
  recipientName: string;
  currentValue: string;
  token: string;
  onConfirm: (val: string) => void;
  onClose: () => void;
}) {
  const defaultVal =
    currentValue ||
    (field.type === "DATE_SIGNED" ? new Date().toISOString().slice(0, 10) :
     field.type === "FULL_NAME"   ? recipientName : "");

  const [val, setVal] = useState(defaultVal);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Derive display name for an existing attachment value
  const attachedFileName = (() => {
    if (!val || field.type !== "ATTACHMENT") return null;
    try { const p = JSON.parse(val) as { name?: string }; return p.name ?? null; } catch { return null; }
  })();

  const isReady = field.type === "CHECKBOX" ? true : field.type === "ATTACHMENT" ? !!val : !!val.trim();

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

        {field.type === "ATTACHMENT" && (
          <div style={{ marginBottom: "8px" }}>
            {/* Agent-provided instructions from field options */}
            {field.options?.[0] && (
              <p style={{ fontSize: "13px", color: "#475569", marginBottom: "10px", lineHeight: 1.5, background: "#f8fafc", borderRadius: "8px", padding: "10px 12px" }}>
                {field.options[0]}
              </p>
            )}
            <label
              style={{
                display: "block",
                border: `2px dashed ${val ? "#10b981" : uploadError ? "#ef4444" : "#e2e8f0"}`,
                borderRadius: "10px",
                padding: val ? "14px" : "28px",
                textAlign: "center",
                cursor: uploadingFile ? "wait" : "pointer",
                opacity: uploadingFile ? 0.7 : 1,
                transition: "border-color 0.15s",
              }}
            >
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                style={{ display: "none" }}
                disabled={uploadingFile}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingFile(true);
                  setUploadError(null);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("fieldId", field.id);
                    const res = await fetch(`/api/sign/${token}/attachment`, { method: "POST", body: fd });
                    const json = await res.json().catch(() => ({})) as { url?: string; name?: string; size?: number; type?: string; error?: { message?: string } };
                    if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed. Please try again.");
                    const attachValue = JSON.stringify({ url: json.url, name: json.name, size: json.size, type: json.type });
                    setVal(attachValue);
                    // Auto-confirm so fieldValues is updated immediately — no manual "Confirm" tap needed
                    onConfirm(attachValue);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
                    setUploadError(msg);
                  } finally {
                    setUploadingFile(false);
                  }
                }}
              />
              {uploadingFile ? (
                <div>
                  <p style={{ fontSize: "14px", color: "#3b82f6", fontWeight: 600, marginBottom: "4px" }}>Uploading...</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Please wait</p>
                </div>
              ) : val ? (
                <div>
                  <p style={{ fontSize: "13px", color: "#10b981", fontWeight: 600, marginBottom: "2px" }}>
                    ✓ {attachedFileName ?? "File attached"}
                  </p>
                  <p style={{ fontSize: "11px", color: "#94a3b8" }}>Tap to replace</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: "14px", color: "#475569", marginBottom: "4px" }}>Tap to upload a file</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Images, PDF, or Word documents — max 20 MB</p>
                </>
              )}
            </label>
            {uploadError && (
              <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "6px", textAlign: "center" }}>
                {uploadError}
              </p>
            )}
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
  const [declineReasonCode, setDeclineReasonCode] = useState<DeclineReasonCode>("NO_REASON_GIVEN");
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState<string | null>(null);
  // "signed" | "declined" | null — tracks how the user exited the signing flow
  const [completionType, setCompletionType] = useState<"signed" | "declined" | null>(null);
  const [completionData, setCompletionData] = useState<{
    certUrl?: string;
    signedBlobUrl?: string;
  }>({});
  const [visiblePage, setVisiblePage] = useState<number | null>(null);

  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const visiblePageRatiosRef = useRef<Record<number, number>>({});
  const activePageViewRef = useRef<{
    page: number;
    startedAtMs: number;
    maxScrollPct: number;
    eventId: string;
  } | null>(null);

  // ── OTP state ─────────────────────────────────────────────────────────────
  const [otpInput, setOtpInput] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email" | "sms" | null>(null);
  const [otpMaskedTarget, setOtpMaskedTarget] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

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
    const authLevel = d.request.authLevel ?? "LINK_ONLY";
    if (authLevel === "EMAIL_OTP" || authLevel === "SMS_OTP") {
      setScreen("otp-required");
    } else {
      setScreen("consent");
    }
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

  // ── OTP: Send ────────────────────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
    if (!token) return;
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch(`/api/sign/${token}/send-otp`, { method: "POST" });
      const json = await res.json().catch(() => ({})) as { channel?: "email" | "sms"; maskedTarget?: string; error?: { message?: string } };
      if (!res.ok) {
        setOtpError(json?.error?.message ?? "Failed to send code.");
        return;
      }
      setOtpChannel(json.channel ?? null);
      setOtpMaskedTarget(json.maskedTarget ?? null);
      setScreen("otp-verify");
    } finally {
      setOtpSending(false);
    }
  }, [token]);

  // ── OTP: Verify ──────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async () => {
    if (!token) return;
    setOtpVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch(`/api/sign/${token}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpInput }),
      });
      const json = await res.json().catch(() => ({})) as { verified?: boolean; channel?: string; error?: { message?: string } };
      if (!res.ok) {
        setOtpError(json?.error?.message ?? "Verification failed.");
        return;
      }
      setOtpInput("");
      setScreen("consent");
    } finally {
      setOtpVerifying(false);
    }
  }, [token, otpInput]);

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

  const flushActivePageView = useCallback(
    async (source: string, opts?: { keepalive?: boolean; preferBeacon?: boolean }) => {
      if (screen !== "signing") return;
      const active = activePageViewRef.current;
      if (!active) return;
      const endedAtMs = Date.now();
      const dwellMs = Math.max(0, endedAtMs - active.startedAtMs);
      activePageViewRef.current = null;

      // Drop ultra-short noise.
      if (dwellMs < 1000) return;

      const payload = {
        eventId: active.eventId,
        page: active.page,
        startedAt: new Date(active.startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        dwellMs,
        maxScrollPct: Math.max(0, Math.min(100, active.maxScrollPct)),
        source,
      };

      try {
        if (opts?.preferBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
          const accepted = navigator.sendBeacon(`/api/sign/${token}/analytics/page-view`, body);
          if (accepted) return;
        }
        await fetch(`/api/sign/${token}/analytics/page-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: opts?.keepalive ?? false,
        });
      } catch {
        // Non-blocking analytics call.
      }
    },
    [screen, token]
  );

  const startPageView = useCallback(
    (page: number) => {
      const now = Date.now();
      activePageViewRef.current = {
        page,
        startedAtMs: now,
        maxScrollPct: 0,
        eventId: crypto.randomUUID(),
      };
    },
    []
  );

  const updateActiveScrollDepth = useCallback(() => {
    const active = activePageViewRef.current;
    if (!active) return;
    const container = scrollContainerRef.current;
    const pageEl = pageRefs.current[active.page];
    if (!container || !pageEl) return;

    const top = pageEl.offsetTop;
    const height = pageEl.offsetHeight;
    if (height <= 0) return;
    const viewedPx = container.scrollTop + container.clientHeight - top;
    const pct = Math.max(0, Math.min(100, (viewedPx / height) * 100));
    if (pct > active.maxScrollPct) {
      active.maxScrollPct = pct;
    }
  }, []);

  useEffect(() => {
    if (screen !== "signing") return;
    if (!visiblePage) return;

    const run = async () => {
      const active = activePageViewRef.current;
      if (active?.page === visiblePage) return;
      await flushActivePageView("page-switch");
      startPageView(visiblePage);
      updateActiveScrollDepth();
    };
    void run();
  }, [screen, visiblePage, flushActivePageView, startPageView, updateActiveScrollDepth]);

  useEffect(() => {
    if (screen !== "signing") return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => updateActiveScrollDepth();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [screen, updateActiveScrollDepth]);

  useEffect(() => {
    if (screen !== "signing") return;
    if (pageImages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const rawPage = (entry.target as HTMLElement).dataset.pageNum;
          const page = Number(rawPage ?? 0);
          if (!page) continue;
          visiblePageRatiosRef.current[page] = entry.isIntersecting ? entry.intersectionRatio : 0;
        }
        const top = Object.entries(visiblePageRatiosRef.current)
          .map(([page, ratio]) => ({ page: Number(page), ratio }))
          .filter((row) => row.ratio > 0.3)
          .sort((a, b) => b.ratio - a.ratio)[0];
        if (top?.page) setVisiblePage(top.page);
      },
      { root: container, threshold: [0.3, 0.5, 0.7, 0.9] }
    );

    for (const [page, node] of Object.entries(pageRefs.current)) {
      if (!node) continue;
      node.dataset.pageNum = page;
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [screen, pageImages.length]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flushActivePageView("tab-hidden", { keepalive: true, preferBeacon: true });
      }
    };
    const handleUnload = () => {
      void flushActivePageView("before-unload", { keepalive: true, preferBeacon: true });
    };
    const handlePageHide = () => {
      void flushActivePageView("page-hide", { keepalive: true, preferBeacon: true });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushActivePageView]);

  useEffect(() => {
    if (screen === "signing") return;
    void flushActivePageView("screen-exit", { keepalive: true });
  }, [screen, flushActivePageView]);

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
      // CHECKBOX: direct toggle on the PDF — no modal needed
      if (field.type === "CHECKBOX") {
        const current = fieldValues[field.id] ?? "";
        setFieldValue(field.id, current === "true" ? "" : "true");
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
      await flushActivePageView("submit-signing", { keepalive: true });
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
  }, [data, token, fieldValues, flushActivePageView]);

  const submitDecline = async () => {
    setDeclineError(null);
    const trimmedReason = declineReason.trim();
    if (declineReasonCode === "OTHER" && trimmedReason.length === 0) {
      setDeclineError("Please provide a reason when selecting Other.");
      return;
    }
    setSubmitting(true);
    try {
      await flushActivePageView("submit-decline", { keepalive: true });
      const res = await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode: declineReasonCode,
          reasonText: trimmedReason || undefined,
        }),
      });
      const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
      if (!res.ok) {
        setDeclineError(json?.error?.message ?? "Unable to decline right now. Please try again.");
        return;
      }
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

  // ── OTP Required ─────────────────────────────────────────────────────────
  if (screen === "otp-required") {
    const channelLabel = (data.request.authLevel ?? "EMAIL_OTP") === "SMS_OTP" ? "phone" : "email";
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
                  Verify Your Identity
                </h2>
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>One more step before signing</p>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.65, marginBottom: "20px" }}>
              To confirm your identity, a 6-digit verification code will be sent to your <strong style={{ color: "var(--foreground)" }}>{channelLabel}</strong>. This helps ensure the document is signed by the right person.
            </p>

            {otpError && (
              <div
                style={{
                  marginBottom: "16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#b91c1c",
                }}
              >
                {otpError}
              </div>
            )}

            <button
              onClick={() => void sendOtp()}
              disabled={otpSending}
              style={{
                width: "100%",
                borderRadius: "12px",
                padding: "13px",
                fontWeight: 700,
                fontSize: "14px",
                color: "white",
                border: "none",
                cursor: otpSending ? "not-allowed" : "pointer",
                background: otpSending ? "#94a3b8" : "linear-gradient(135deg, #00A3FF, #0057FF)",
                boxShadow: otpSending ? "none" : "0 4px 14px rgba(0,87,255,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {otpSending && (
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "white",
                    animation: "sc-spin 0.7s linear infinite",
                  }}
                />
              )}
              {otpSending ? "Sending…" : "Send Verification Code"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── OTP Verify ───────────────────────────────────────────────────────────
  if (screen === "otp-verify") {
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
                  Enter Verification Code
                </h2>
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {otpMaskedTarget ? `A 6-digit code was sent to ${otpMaskedTarget}` : "A 6-digit code was sent"}
                </p>
              </div>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              style={{
                width: "100%",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "12px",
                textAlign: "center",
                background: "var(--background)",
                color: "var(--foreground)",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "16px",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && otpInput.length === 6) void verifyOtp();
              }}
            />

            {otpError && (
              <div
                style={{
                  marginBottom: "16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#b91c1c",
                }}
              >
                {otpError}
              </div>
            )}

            <button
              onClick={() => void verifyOtp()}
              disabled={otpVerifying || otpInput.length !== 6}
              style={{
                width: "100%",
                borderRadius: "12px",
                padding: "13px",
                fontWeight: 700,
                fontSize: "14px",
                color: "white",
                border: "none",
                cursor: otpVerifying || otpInput.length !== 6 ? "not-allowed" : "pointer",
                background: otpVerifying || otpInput.length !== 6 ? "#94a3b8" : "linear-gradient(135deg, #00A3FF, #0057FF)",
                boxShadow: otpVerifying || otpInput.length !== 6 ? "none" : "0 4px 14px rgba(0,87,255,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {otpVerifying && (
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "white",
                    animation: "sc-spin 0.7s linear infinite",
                  }}
                />
              )}
              {otpVerifying ? "Verifying…" : "Verify"}
            </button>

            <p style={{ textAlign: "center", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Didn&apos;t receive a code?{" "}
              <button
                onClick={() => {
                  setOtpInput("");
                  setOtpError(null);
                  void sendOtp();
                }}
                disabled={otpSending}
                style={{
                  background: "none",
                  border: "none",
                  color: "#3b82f6",
                  textDecoration: "underline",
                  cursor: otpSending ? "not-allowed" : "pointer",
                  fontSize: "inherit",
                  padding: 0,
                }}
              >
                {otpSending ? "Sending…" : "Resend code"}
              </button>
            </p>
          </div>
        </div>
        <style>{`@keyframes sc-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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

            <div style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.65, marginBottom: "16px" }}>
              <p style={{ marginBottom: "10px" }}>
                By clicking <strong style={{ color: "var(--foreground)" }}>Agree & Continue</strong>, you agree to sign{" "}
                <strong style={{ color: "var(--foreground)" }}>{data.request.title ?? "this document"}</strong> electronically.
              </p>
            </div>

            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px",
                lineHeight: 1.6,
                color: "var(--muted-foreground)",
                whiteSpace: "pre-wrap",
                marginBottom: "8px",
              }}
            >
              {CONSENT_TEXT_V1}
            </div>

            <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "18px", textAlign: "right" }}>
              Consent disclosure v1 · SecureLink
            </p>

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
            Why are you declining?
          </label>
          <select
            value={declineReasonCode}
            onChange={(e) => {
              setDeclineReasonCode(e.target.value as DeclineReasonCode);
              setDeclineError(null);
              if (e.target.value !== "OTHER") setDeclineReason("");
            }}
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "14px",
              background: "var(--background)",
              color: "var(--foreground)",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "10px",
            }}
          >
            {DECLINE_REASON_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            maxLength={500}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={
              declineReasonCode === "OTHER"
                ? "Please add a short reason…"
                : `Optional details for "${DECLINE_REASON_LABELS[declineReasonCode]}"`
            }
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
              marginBottom: "6px",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              {declineReasonCode === "OTHER" ? "Details are required for Other." : "Details are optional."}
            </p>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{declineReason.length}/500</p>
          </div>
          {declineError && (
            <div
              style={{
                marginBottom: "14px",
                fontSize: "12px",
                borderRadius: "8px",
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                padding: "8px 10px",
              }}
            >
              {declineError}
            </div>
          )}
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
          height: "100vh",
          background: "#e8ecf0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
          }}
        >
          {/* Agent branding bar */}
          <div
            style={{
              borderBottom: "1px solid #f1f5f9",
              padding: "8px 16px",
            }}
          >
            <div
              style={{
                maxWidth: "840px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Left spacer */}
              <div style={{ width: "36px" }} />
              {/* Center: logo or wordmark */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                {data.agent.logoUrl ? (
                  <img
                    src={data.agent.logoUrl}
                    alt={data.agent.agencyName ?? data.agent.displayName}
                    style={{ height: "28px", maxWidth: "120px", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.5px", color: "#0f172a" }}>
                    Secure<span style={{ color: "#3b82f6" }}>Link</span>
                  </span>
                )}
                {(data.agent.agencyName || data.agent.company) && (
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {data.agent.agencyName ?? data.agent.company}
                  </span>
                )}
              </div>
              {/* Right: agent photo / initials */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                {data.agent.photoUrl ? (
                  <img
                    src={data.agent.photoUrl}
                    alt={data.agent.displayName}
                    style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", border: "2px solid #e2e8f0" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {data.agent.displayName.trim().split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                )}
                <span style={{ fontSize: "9px", color: "#94a3b8", maxWidth: "50px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {data.agent.displayName}
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: "10px 16px 0" }}>
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
        </div>

        {/* Scrollable PDF area */}
        <div
          ref={scrollContainerRef}
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
                        {val && !val.startsWith("data:") && field.type !== "CHECKBOX" && (
                          <p style={{ fontSize: "13px", color: colors.text, fontWeight: 500, marginTop: "2px" }}>{val}</p>
                        )}
                        {val === "true" && field.type === "CHECKBOX" && (
                          <p style={{ fontSize: "13px", color: "#15803d", fontWeight: 600, marginTop: "2px" }}>✓ Checked</p>
                        )}
                        {val && val.startsWith("data:image") && (
                          <p style={{ fontSize: "12px", color: "#10b981", marginTop: "2px" }}>✓ Captured</p>
                        )}
                        {val && val.startsWith("data:") && !val.startsWith("data:image") && (
                          <p style={{ fontSize: "12px", color: "#10b981", marginTop: "2px" }}>📎 File attached</p>
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
                    ref={(el) => { pageRefs.current[pageNum] = el; }}
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
                        // For overlay display: CHECKBOX shows filled only when actually checked
                        const done = field.type === "CHECKBOX" ? val === "true" : isFieldDone(field, val);
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
                              border: `${done || (isNext && !done) ? "2px" : "1.5px"} solid ${colors.border}`,
                              borderRadius: "3px",
                              boxSizing: "border-box",
                              background: done
                                ? (isImg ? "rgba(255,255,255,0.05)"
                                  : field.type === "CHECKBOX" ? "#16a34a"
                                  : colors.bg)
                                : colors.bg + "99",
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
                            ) : done && field.type === "ATTACHMENT" ? (
                              <span style={{ fontSize: "clamp(10px,2.2vw,13px)", color: colors.text, fontWeight: 700 }}>📎 Attached</span>
                            ) : done && field.type === "CHECKBOX" ? (
                              // Large ✓ on solid green background — unmissable
                              <svg viewBox="0 0 14 12" style={{ width: "60%", height: "60%" }} fill="none">
                                <path d="M1 6l4 4L13 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : done && field.type === "DATE_SIGNED" ? (
                              <span
                                style={{
                                  fontSize: "clamp(10px, 2.2vw, 14px)",
                                  color: colors.text,
                                  fontWeight: 700,
                                  padding: "0 4px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: "100%",
                                  lineHeight: 1.2,
                                  textShadow: "0 0 0 transparent",
                                }}
                              >
                                {fmtDate(val)}
                              </span>
                            ) : done ? (
                              // All other text fields: show value clearly with readable font size
                              <span
                                style={{
                                  fontSize: "clamp(10px, 2.2vw, 14px)",
                                  color: colors.text,
                                  fontWeight: 700,
                                  padding: "0 4px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: "100%",
                                  lineHeight: 1.2,
                                }}
                              >
                                {val}
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
              token={token}
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
