"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import SignaturePad from "signature_pad";

// ── Types ──────────────────────────────────────────────────────────────────────

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

type Screen = "loading" | "error" | "consent" | "overview" | "signing" | "decline-form" | "complete";

// ── Field value state ──────────────────────────────────────────────────────────

type FieldValues = Record<string, string>;

// ── Utilities ──────────────────────────────────────────────────────────────────

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

function fieldLabel(type: string): string {
  const labels: Record<string, string> = {
    SIGNATURE: "Signature",
    INITIALS: "Initials",
    DATE_SIGNED: "Date",
    FULL_NAME: "Full Name",
    TITLE: "Title",
    COMPANY: "Company",
    TEXT: "Text",
    CHECKBOX: "Checkbox",
    RADIO: "Selection",
    DROPDOWN: "Dropdown",
    ATTACHMENT: "Attachment",
  };
  return labels[type] ?? type;
}

// ── Signature pad component ────────────────────────────────────────────────────

function SignaturePadField({
  fieldId,
  label,
  value,
  onChange,
}: {
  fieldId: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      minWidth: 1.5,
      maxWidth: 3,
      penColor: "rgb(0, 30, 160)",
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;

    // If there's an existing value, load it
    if (value && value.startsWith("data:image")) {
      pad.fromDataURL(value);
      setIsEmpty(false);
    }

    pad.addEventListener("endStroke", () => {
      if (!pad.isEmpty()) {
        setIsEmpty(false);
        onChange(pad.toDataURL("image/png"));
      }
    });

    // Resize observer to handle canvas scaling
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      // Re-draw if had signature
      if (!pad.isEmpty()) pad.fromData(pad.toData());
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
      pad.off();
    };
  }, [fieldId]); // only on field change

  const clear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
    onChange("");
  };

  return (
    <div>
      <p className="text-xs font-medium text-[color:var(--muted-foreground)] mb-2 uppercase tracking-wide">
        {label}
      </p>
      <div
        style={{
          border: "2px solid var(--border)",
          borderRadius: "10px",
          background: "#fafafa",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "120px",
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        {isEmpty && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>
              Draw your {label.toLowerCase()} here
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={clear}
          className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] underline"
        >
          Clear
        </button>
        {!isEmpty && (
          <span className="text-xs text-green-600 font-medium">✓ Captured</span>
        )}
      </div>
    </div>
  );
}

// ── Individual field input ─────────────────────────────────────────────────────

function FieldInput({
  field,
  recipientName,
  value,
  onChange,
}: {
  field: Field;
  recipientName: string;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "SIGNATURE" || field.type === "INITIALS") {
    return (
      <SignaturePadField
        fieldId={field.id}
        label={fieldLabel(field.type)}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (field.type === "DATE_SIGNED") {
    return (
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)] mb-2 uppercase tracking-wide">
          Date Signed
        </p>
        <input
          type="date"
          value={value || new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[color:var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  if (field.type === "FULL_NAME") {
    return (
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)] mb-2 uppercase tracking-wide">
          Full Name
        </p>
        <input
          type="text"
          placeholder={recipientName}
          value={value || recipientName}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[color:var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  if (field.type === "CHECKBOX") {
    return (
      <div
        className="flex items-center gap-3 cursor-pointer select-none"
        onClick={() => onChange(value === "true" ? "false" : "true")}
      >
        <div
          style={{
            width: "22px",
            height: "22px",
            border: "2px solid #3b82f6",
            borderRadius: "5px",
            background: value === "true" ? "#3b82f6" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {value === "true" && (
            <svg viewBox="0 0 12 10" width="12" height="10" fill="none">
              <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-sm text-[color:var(--foreground)]">
          {fieldLabel(field.type)}
        </span>
      </div>
    );
  }

  if (field.type === "DROPDOWN" && field.options && field.options.length > 0) {
    return (
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)] mb-2 uppercase tracking-wide">
          {fieldLabel(field.type)}
        </p>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[color:var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an option…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "RADIO" && field.options && field.options.length > 0) {
    return (
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)] mb-2 uppercase tracking-wide">
          {fieldLabel(field.type)}
        </p>
        <div className="flex flex-col gap-2">
          {field.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-blue-600"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  // Generic text input (TEXT, TITLE, COMPANY, etc.)
  return (
    <div>
      <p className="text-xs font-medium text-[color:var(--muted-foreground)] mb-2 uppercase tracking-wide">
        {fieldLabel(field.type)}
      </p>
      <input
        type="text"
        placeholder={`Enter ${fieldLabel(field.type).toLowerCase()}…`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[color:var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// ── Field validation ───────────────────────────────────────────────────────────

function isFieldComplete(field: Field, value: string): boolean {
  if (!field.required) return true;
  if (!value) return false;
  if (field.type === "SIGNATURE" || field.type === "INITIALS") {
    return value.startsWith("data:image") && value.length > 100;
  }
  if (field.type === "CHECKBOX") return true; // checkbox is always "done"
  return value.trim().length > 0;
}

// ── Main Signing Ceremony ─────────────────────────────────────────────────────

export function SigningCeremony({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [data, setData] = useState<DocData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [fieldIndex, setFieldIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [completionData, setCompletionData] = useState<{
    certUrl?: string;
    signedBlobUrl?: string;
  }>({});

  // Load signing data
  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          // apiSuccess returns data flat (no wrapper) — error shape: { error: { message } }
          setErrorMsg((json as { error?: { message?: string } }).error?.message ?? "This signing link is not available.");
          setScreen("error");
          return;
        }
        // apiSuccess returns data directly at the top level, not wrapped in .data
        if ((json as { _flow?: string })._flow !== "new") {
          setErrorMsg("Unexpected flow.");
          setScreen("error");
          return;
        }
        const d = json as DocData;
        setData(d);

        // Pre-fill DATE_SIGNED and FULL_NAME
        const prefill: FieldValues = {};
        for (const f of d.fields) {
          if (f.type === "DATE_SIGNED") {
            prefill[f.id] = new Date().toISOString().slice(0, 10);
          } else if (f.type === "FULL_NAME") {
            prefill[f.id] = d.recipient.name;
          }
        }
        setFieldValues(prefill);
        setScreen("consent");
      })
      .catch(() => {
        setErrorMsg("Unable to load signing request. Please check your connection and try again.");
        setScreen("error");
      });
  }, [token]);

  const sendConsent = useCallback(async () => {
    await fetch(`/api/sign/${token}/consent`, { method: "POST" });
    setScreen("overview");
  }, [token]);

  const handleFieldChange = (id: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [id]: val }));
  };

  const currentField = data?.fields[fieldIndex] ?? null;
  const currentValue = currentField ? (fieldValues[currentField.id] ?? "") : "";
  const currentDone = currentField ? isFieldComplete(currentField, currentValue) : false;

  const goNext = () => {
    if (!data) return;
    if (fieldIndex < data.fields.length - 1) {
      setFieldIndex((i) => i + 1);
    } else {
      // All fields done — submit
      submitSigning();
    }
  };

  const goPrev = () => {
    if (fieldIndex > 0) setFieldIndex((i) => i - 1);
  };

  const submitSigning = async () => {
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
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error?.message ?? "Submission failed. Please try again.");
        setScreen("error");
        return;
      }
      setCompletionData({
        certUrl: json.data.certUrl,
        signedBlobUrl: json.data.signedBlobUrl,
      });
      setScreen("complete");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setScreen("error");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecline = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      setScreen("complete"); // reuse complete screen with decline message
      setCompletionData({});
    } finally {
      setSubmitting(false);
    }
  };

  // ── Screens ──────────────────────────────────────────────────────────────────

  if (screen === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] p-6">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-[color:var(--muted-foreground)]">Loading signing request…</p>
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] p-6 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[color:var(--foreground)] mb-2 text-center">
          Unable to load document
        </h1>
        <p className="text-sm text-[color:var(--muted-foreground)] text-center leading-relaxed">
          {errorMsg}
        </p>
      </div>
    );
  }

  if (!data) return null;

  // ── Screen 1: ESIGN Consent ───────────────────────────────────────────────

  if (screen === "consent") {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
          {/* Logo strip */}
          <div className="mb-8 text-center">
            <span className="text-2xl font-extrabold tracking-tight text-[color:var(--foreground)]">
              Secure<span className="text-blue-500">Link</span>
            </span>
            <p className="text-xs text-[color:var(--muted-foreground)] mt-1 tracking-widest uppercase">
              Electronic Signing
            </p>
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "32px 28px",
              width: "100%",
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-[color:var(--foreground)] text-base leading-tight">
                  Electronic Consent
                </h2>
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  Required before signing
                </p>
              </div>
            </div>

            <div className="text-sm text-[color:var(--muted-foreground)] leading-relaxed space-y-3 mb-6">
              <p>
                By clicking <strong className="text-[color:var(--foreground)]">Agree & Continue</strong>, you agree to sign{" "}
                <strong className="text-[color:var(--foreground)]">
                  {data.request.title ?? "this document"}
                </strong>{" "}
                electronically.
              </p>
              <p>
                Your electronic signature has the same legal effect as a handwritten signature under the{" "}
                <strong className="text-[color:var(--foreground)]">Electronic Signatures in Global and National Commerce (ESIGN) Act</strong> and the{" "}
                <strong className="text-[color:var(--foreground)]">Uniform Electronic Transactions Act (UETA)</strong>.
              </p>
              <p>
                Your IP address, browser information, and the exact time of signing will be captured and stored as part of the audit trail.
              </p>
            </div>

            <div
              style={{
                background: "var(--muted)",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: "20px",
                fontSize: "12px",
                color: "var(--muted-foreground)",
              }}
            >
              Requested by <strong style={{ color: "var(--foreground)" }}>{data.agent.displayName}</strong>
              {data.agent.agencyName && ` · ${data.agent.agencyName}`}
              {" · "}Expires {fmtExpiry(data.request.expiresAt)}
            </div>

            <button
              onClick={sendConsent}
              className="w-full rounded-xl py-3 font-semibold text-white text-sm"
              style={{
                background: "linear-gradient(135deg, #00A3FF, #0057FF)",
                boxShadow: "0 4px 14px rgba(0,87,255,0.25)",
              }}
            >
              Agree & Continue
            </button>

            <p
              className="text-center text-xs mt-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              You may{" "}
              <button
                onClick={() => setScreen("decline-form")}
                className="underline hover:text-[color:var(--foreground)]"
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

  // ── Screen 2: Document Overview ───────────────────────────────────────────

  if (screen === "overview") {
    const requiredCount = data.fields.filter((f) => f.required).length;
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
          <div className="mb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[color:var(--foreground)] mb-1">
              {data.request.title ?? "Document Ready to Sign"}
            </h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              From {data.agent.displayName}
              {data.agent.agencyName && ` · ${data.agent.agencyName}`}
            </p>
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "100%",
              overflow: "hidden",
              marginBottom: "20px",
            }}
          >
            {data.request.message && (
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "14px",
                  color: "var(--muted-foreground)",
                  lineHeight: "1.6",
                  fontStyle: "italic",
                }}
              >
                "{data.request.message}"
              </div>
            )}

            {[
              { label: "Signing for", value: `${data.recipient.name} · ${data.recipient.email}` },
              { label: "Fields to complete", value: `${requiredCount} required${data.fields.length > requiredCount ? ` · ${data.fields.length - requiredCount} optional` : ""}` },
              { label: "Expires", value: fmtExpiry(data.request.expiresAt) },
              ...(data.totalRecipients > 1
                ? [{ label: "Signing", value: `${data.completedCount} of ${data.totalRecipients} signers completed (${data.request.signingMode.toLowerCase()})` }]
                : []),
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border)",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)", flexShrink: 0, paddingTop: "1px" }}>
                  {label}
                </span>
                <span style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: 500, textAlign: "right" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {data.request.blobUrl && (
            <a
              href={data.request.blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 underline mb-5 flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Preview full document
            </a>
          )}

          <button
            onClick={() => { setFieldIndex(0); setScreen("signing"); }}
            className="w-full rounded-xl py-3.5 font-semibold text-white text-sm"
            style={{
              background: "linear-gradient(135deg, #00A3FF, #0057FF)",
              boxShadow: "0 4px 14px rgba(0,87,255,0.25)",
            }}
          >
            Start Signing →
          </button>
        </div>
      </div>
    );
  }

  // ── Screen 3: Signing (one field at a time) ───────────────────────────────

  if (screen === "signing" && currentField) {
    const totalFields = data.fields.length;
    const progress = (fieldIndex / totalFields) * 100;
    const isLast = fieldIndex === totalFields - 1;
    const allRequired = data.fields.filter((f) => f.required);
    const allRequiredDone = allRequired.every((f) =>
      isFieldComplete(f, fieldValues[f.id] ?? "")
    );

    return (
      <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
        {/* Top progress bar */}
        <div style={{ height: "4px", background: "var(--border)" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #00A3FF, #0057FF)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--card)",
          }}
        >
          <div>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {data.request.title ?? "Document Signing"}
            </p>
            <p className="text-xs font-medium text-[color:var(--foreground)]">
              Field {fieldIndex + 1} of {totalFields}
            </p>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "99px",
              background: currentDone ? "#dcfce7" : "#fef9c3",
              color: currentDone ? "#15803d" : "#92400e",
            }}
          >
            {currentDone ? "✓ Done" : "Required"}
          </span>
        </div>

        {/* Field area */}
        <div className="flex-1 flex flex-col justify-between p-5 max-w-lg mx-auto w-full">
          <div>
            {/* Mini doc context */}
            {data.request.blobUrl && (
              <div
                style={{
                  background: "var(--muted)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginBottom: "16px",
                  border: "1px solid var(--border)",
                  position: "relative",
                }}
              >
                <iframe
                  src={`${data.request.blobUrl}#page=${currentField.page}&toolbar=0&navpanes=0`}
                  style={{ width: "100%", height: "180px", border: "none", display: "block" }}
                  title="Document preview"
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "40px",
                    background: "linear-gradient(transparent, var(--muted))",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "6px",
                    right: "8px",
                    fontSize: "10px",
                    color: "var(--muted-foreground)",
                  }}
                >
                  Page {currentField.page}
                </div>
              </div>
            )}

            {/* The actual field input */}
            <FieldInput
              field={currentField}
              recipientName={data.recipient.name}
              value={currentValue}
              onChange={(v) => handleFieldChange(currentField.id, v)}
            />

            {!currentField.required && (
              <p className="text-xs text-[color:var(--muted-foreground)] mt-2">
                This field is optional.
              </p>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {fieldIndex > 0 && (
              <button
                onClick={goPrev}
                className="flex-1 rounded-xl py-3 font-medium text-sm border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--muted)]"
              >
                ← Back
              </button>
            )}
            <button
              onClick={goNext}
              disabled={currentField.required && !currentDone || submitting}
              className="flex-1 rounded-xl py-3 font-semibold text-sm text-white disabled:opacity-50"
              style={{
                background:
                  currentField.required && !currentDone
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #00A3FF, #0057FF)",
              }}
            >
              {submitting
                ? "Submitting…"
                : isLast
                ? allRequiredDone
                  ? "Submit Signatures →"
                  : "Skip (optional)"
                : "Next Field →"}
            </button>
          </div>

          {/* Field navigation pills */}
          {data.fields.length > 1 && (
            <div className="flex gap-1.5 mt-4 flex-wrap justify-center">
              {data.fields.map((f, i) => {
                const done = isFieldComplete(f, fieldValues[f.id] ?? "");
                return (
                  <button
                    key={f.id}
                    onClick={() => setFieldIndex(i)}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background:
                        i === fieldIndex
                          ? "#0057FF"
                          : done
                          ? "#22c55e"
                          : "var(--border)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Decline form ──────────────────────────────────────────────────────────

  if (screen === "decline-form") {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex flex-col items-center justify-center p-6 max-w-md mx-auto">
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "28px",
            width: "100%",
          }}
        >
          <h2 className="text-lg font-bold text-[color:var(--foreground)] mb-2">
            Decline to sign?
          </h2>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-5 leading-relaxed">
            If you decline, the document will be voided and{" "}
            <strong className="text-[color:var(--foreground)]">
              {data.agent.displayName}
            </strong>{" "}
            will be notified. This action cannot be undone.
          </p>

          <label className="block text-xs font-medium text-[color:var(--muted-foreground)] mb-1.5 uppercase tracking-wide">
            Reason (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Let the sender know why you're declining…"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[color:var(--background)] focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-5"
          />

          <div className="flex gap-3">
            <button
              onClick={() => setScreen("consent")}
              className="flex-1 rounded-xl py-2.5 font-medium text-sm border border-[color:var(--border)] text-[color:var(--foreground)]"
            >
              Go back
            </button>
            <button
              onClick={submitDecline}
              disabled={submitting}
              className="flex-1 rounded-xl py-2.5 font-semibold text-sm text-white bg-red-500 disabled:opacity-50"
            >
              {submitting ? "Declining…" : "Confirm Decline"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Completion screen ─────────────────────────────────────────────────────

  if (screen === "complete") {
    const didDecline = !completionData.certUrl && !completionData.signedBlobUrl;
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex flex-col items-center justify-center p-6 max-w-md mx-auto">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: didDecline ? "#fee2e2" : "linear-gradient(135deg, #d1fae5, #bbf7d0)",
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

          <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">
            {didDecline ? "Declined" : "Signed Successfully"}
          </h1>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-8 leading-relaxed max-w-xs mx-auto">
            {didDecline
              ? `You have declined to sign${data.request.title ? ` "${data.request.title}"` : ""}. The sender has been notified.`
              : `You have successfully signed${data.request.title ? ` "${data.request.title}"` : ""}. An email confirmation will be sent to ${data.recipient.email}.`}
          </p>

          {!didDecline && (completionData.signedBlobUrl || completionData.certUrl) && (
            <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
              {completionData.signedBlobUrl && (
                <a
                  href={completionData.signedBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #00A3FF, #0057FF)" }}
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
                  className="flex items-center justify-center gap-2 rounded-xl py-3 font-medium text-sm border border-[color:var(--border)] text-[color:var(--foreground)]"
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

          <p className="text-xs text-[color:var(--muted-foreground)] mt-8">
            You can safely close this window.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
