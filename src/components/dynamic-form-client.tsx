"use client";

import { useState, useRef } from "react";
import { CheckCircle2, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientTrustHeader } from "@/components/client-trust-header";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@/lib/error-message";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtSsn(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

type FormFieldType =
  | "text" | "email" | "phone" | "address" | "date"
  | "dropdown" | "ssn" | "routing" | "bank_account" | "signature";

interface FormField {
  id: string;
  label: string;
  fieldType: FormFieldType;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  maskInput: boolean;
  confirmField: boolean;
  dropdownOptions: string[] | null;
}

interface Agent {
  displayName: string;
  agencyName: string | null;
  company: string | null;
  industry: string | null;
  logoUrl: string | null;
  destinationLabel: string | null;
  licenseNumber: string | null;
  verificationStatus: string;
  phone?: string | null;
}

interface Props {
  token: string;
  form: { title: string; description: string | null };
  fields: FormField[];
  agent: Agent;
  logoUrls?: string[];
  link: { clientName: string | null; expiresAt: string };
}

export function DynamicFormClient({ token, form, fields, agent, logoUrls = [], link }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmValues, setConfirmValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function setValue(fieldId: string, value: string) {
    setValues((v) => ({ ...v, [fieldId]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[fieldId]; return n; });
  }

  function setConfirmValue(fieldId: string, value: string) {
    setConfirmValues((v) => ({ ...v, [fieldId]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[`confirm_${fieldId}`]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});

    // Build body: field id -> value, confirm_fieldId -> confirm value
    const body: Record<string, string> = {};
    for (const field of fields) {
      if (values[field.id]) body[field.id] = values[field.id];
      if (field.confirmField && confirmValues[field.id]) {
        body[`confirm_${field.id}`] = confirmValues[field.id];
      }
    }

    const res = await fetch(`/api/f/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const parsedFieldErrors = getFieldErrors(data);
      if (Object.keys(parsedFieldErrors).length > 0) setFieldErrors(parsedFieldErrors);
      setError(getErrorMessage(data, "Submission failed. Please try again."));
      return;
    }

    setSubmitted(true);
  }

  const agentProfile = {
    displayName: agent.displayName,
    agencyName: agent.agencyName,
    company: agent.company,
    industry: agent.industry,
    destinationLabel: agent.destinationLabel,
    licenseNumber: agent.licenseNumber,
    verificationStatus: agent.verificationStatus,
    phone: agent.phone ?? null,
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Submitted securely</h1>
          <p className="text-slate-500 leading-relaxed mb-8">
            Your information has been encrypted and delivered to {agent.displayName}. You can close this page.
          </p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-sm text-slate-500 text-left space-y-3">
            {[
              "Encrypted with AES-256 before storage",
              "Delivered only to your agent",
              "Automatically deleted after the retention period",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <ClientTrustHeader logoUrls={logoUrls} agent={agentProfile} expiresAt={link.expiresAt} />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-md mx-auto">

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Form title */}
          <h2 className="text-base font-semibold text-slate-900 mb-1">{form.title}</h2>
          {form.description && (
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">{form.description}</p>
          )}
          <p className="text-sm text-slate-500 mb-5 leading-relaxed">
            Enter your information below to securely submit your personal information. This form is end-to-end encrypted.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={values[field.id] ?? ""}
                confirmValue={confirmValues[field.id] ?? ""}
                error={fieldErrors[field.id]}
                confirmError={fieldErrors[`confirm_${field.id}`]}
                onChange={(v) => setValue(field.id, v)}
                onConfirmChange={(v) => setConfirmValue(field.id, v)}
              />
            ))}

            {/* Consent */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-600 leading-relaxed">
                  I consent to share this information with {agent.displayName}
                  {agent.agencyName ? ` (${agent.agencyName})` : ""} for the purpose of completing my application.
                  I understand it will be encrypted, retained for a limited period, and deleted afterward.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={loading || !consent}
            >
              {loading ? "Submitting..." : "Submit securely"}
            </Button>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              This link is single-use and expires after submission. Your information is encrypted and not shared with third parties.
            </p>
          </form>
        </div>
        </div>
      </main>
    </div>
  );
}

interface DynamicFieldProps {
  field: FormField;
  value: string;
  confirmValue: string;
  error?: string;
  confirmError?: string;
  onChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
}

function DynamicField({ field, value, confirmValue, error, confirmError, onChange, onConfirmChange }: DynamicFieldProps) {
  const [showVal, setShowVal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Signature ──────────────────────────────────────────────────────────────
  if (field.fieldType === "signature") {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <SignaturePad value={value} onChange={onChange} error={!!error} />
      </FieldWrapper>
    );
  }

  // ── Dropdown ───────────────────────────────────────────────────────────────
  if (field.fieldType === "dropdown" && field.dropdownOptions) {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className={cn(
              "flex h-11 w-full appearance-none rounded-lg border bg-background px-3 py-2 pr-9 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              error ? "border-red-400 focus-visible:ring-red-400" : "border-input",
              !value && "text-slate-400"
            )}
          >
            <option value="">{field.placeholder ?? "Select an option"}</option>
            {field.dropdownOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </FieldWrapper>
    );
  }

  // ── SSN ───────────────────────────────────────────────────────────────────
  if (field.fieldType === "ssn") {
    return (
      <>
        <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? "Auto-formats as XXX-XX-XXXX"}>
          <MaskedInput
            value={value}
            onChange={(v) => onChange(fmtSsn(v))}
            masked={field.maskInput && !showVal}
            onToggle={() => setShowVal((s) => !s)}
            showMaskToggle={field.maskInput}
            placeholder="XXX-XX-XXXX"
            inputMode="numeric"
            maxLength={11}
            hasError={!!error}
          />
        </FieldWrapper>
        {field.confirmField && (
          <FieldWrapper label={`Confirm ${field.label}`} required={field.required} error={confirmError}>
            <MaskedInput
              value={confirmValue}
              onChange={(v) => onConfirmChange(fmtSsn(v))}
              masked={field.maskInput && !showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              showMaskToggle={field.maskInput}
              placeholder="Re-enter SSN"
              inputMode="numeric"
              maxLength={11}
              hasError={!!confirmError}
            />
          </FieldWrapper>
        )}
      </>
    );
  }

  // ── Routing number ────────────────────────────────────────────────────────
  if (field.fieldType === "routing") {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? "9-digit number printed on your check"}>
        <Input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder={field.placeholder ?? "021000021"}
          autoComplete="off"
          maxLength={9}
          required={field.required}
          className={error ? "border-red-400 focus-visible:ring-red-400" : ""}
        />
      </FieldWrapper>
    );
  }

  // ── Bank account ──────────────────────────────────────────────────────────
  if (field.fieldType === "bank_account") {
    return (
      <>
        <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
          <MaskedInput
            value={value}
            onChange={(v) => onChange(v.replace(/\D/g, ""))}
            masked={field.maskInput && !showVal}
            onToggle={() => setShowVal((s) => !s)}
            showMaskToggle={field.maskInput}
            placeholder={field.placeholder ?? "Account number"}
            inputMode="numeric"
            hasError={!!error}
          />
        </FieldWrapper>
        {field.confirmField && (
          <FieldWrapper label={`Confirm ${field.label}`} required={field.required} error={confirmError}>
            <MaskedInput
              value={confirmValue}
              onChange={(v) => onConfirmChange(v.replace(/\D/g, ""))}
              masked={field.maskInput && !showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              showMaskToggle={field.maskInput}
              placeholder="Re-enter account number"
              inputMode="numeric"
              hasError={!!confirmError}
            />
          </FieldWrapper>
        )}
      </>
    );
  }

  // ── Phone ─────────────────────────────────────────────────────────────────
  if (field.fieldType === "phone") {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <Input
          type="tel"
          value={value}
          onChange={(e) => onChange(fmtPhone(e.target.value))}
          placeholder={field.placeholder ?? "(555) 000-0000"}
          autoComplete="tel"
          required={field.required}
          className={error ? "border-red-400 focus-visible:ring-red-400" : ""}
        />
      </FieldWrapper>
    );
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  if (field.fieldType === "date") {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          required={field.required}
          className={cn(
            "cursor-pointer",
            error ? "border-red-400 focus-visible:ring-red-400" : ""
          )}
        />
      </FieldWrapper>
    );
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (field.fieldType === "email") {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? "you@email.com"}
          autoComplete="email"
          required={field.required}
          className={error ? "border-red-400 focus-visible:ring-red-400" : ""}
        />
      </FieldWrapper>
    );
  }

  // ── Default (text / address) ───────────────────────────────────────────────
  const autoComplete = field.fieldType === "address" ? "street-address" : undefined;
  return (
    <>
      <FieldWrapper label={field.label} required={field.required} error={error} hint={!field.confirmField ? (field.helpText ?? undefined) : undefined}>
        <Input
          type={field.maskInput ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
          autoComplete={autoComplete}
          required={field.required}
          className={error ? "border-red-400 focus-visible:ring-red-400" : ""}
        />
      </FieldWrapper>
      {field.confirmField && (
        <FieldWrapper label={`Confirm ${field.label}`} required={field.required} error={confirmError} hint={field.helpText ?? undefined}>
          <Input
            type={field.maskInput ? "password" : "text"}
            value={confirmValue}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder={`Re-enter ${field.label.toLowerCase()}`}
            autoComplete="off"
            required={field.required}
            className={confirmError ? "border-red-400 focus-visible:ring-red-400" : ""}
          />
        </FieldWrapper>
      )}
    </>
  );
}

// ── Masked input with show/hide toggle ────────────────────────────────────────

function MaskedInput({
  value, onChange, masked, onToggle, showMaskToggle,
  placeholder, inputMode, maxLength, hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  masked: boolean;
  onToggle: () => void;
  showMaskToggle: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  hasError: boolean;
}) {
  return (
    <div className="relative">
      <Input
        type={masked ? "password" : "text"}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={maxLength}
        className={cn(
          showMaskToggle && "pr-10",
          hasError ? "border-red-400 focus-visible:ring-red-400" : ""
        )}
      />
      {showMaskToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          tabIndex={-1}
          aria-label={masked ? "Show" : "Hide"}
        >
          {masked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

function FieldWrapper({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Signature Pad ─────────────────────────────────────────────────────────────

function SignaturePad({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  error: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
    if ("touches" in e) e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastPos.current = pos;
    hasDrawnRef.current = true;
    setHasDrawn(true);
    if ("touches" in e) e.preventDefault();
  }

  function endDraw() {
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasDrawnRef.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <div className={cn(
        "relative border-2 rounded-xl overflow-hidden bg-white select-none",
        error ? "border-red-400" : hasDrawn ? "border-slate-400" : "border-dashed border-slate-200"
      )}>
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="w-full touch-none cursor-crosshair block"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && !value && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1.5">
            <p className="text-sm text-slate-400">Draw your signature here</p>
            <p className="text-xs text-slate-300">Use mouse or finger</p>
          </div>
        )}
        {hasDrawn && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear signature"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {hasDrawn && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Signature captured
        </p>
      )}
    </div>
  );
}
