"use client";

import { useState, useRef } from "react";
import {
  Lock, Shield, Clock, CheckCircle2, BadgeCheck, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

interface Props {
  token: string;
  form: { title: string; description: string | null };
  fields: FormField[];
  agent: Agent;
  link: { clientName: string | null; expiresAt: string };
}

const VERIFICATION_LABELS: Record<string, string> = {
  LICENSED: "Licensed Agent",
  CERTIFIED: "Certified Agent",
  REGULATED: "Regulated Professional",
};

const VERIFICATION_COLORS: Record<string, string> = {
  LICENSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CERTIFIED: "bg-blue-50 text-blue-700 border-blue-200",
  REGULATED: "bg-purple-50 text-purple-700 border-purple-200",
};

export function DynamicFormClient({ token, form, fields, agent, link }: Props) {
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
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data.error ?? "Submission failed. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  const expiresDate = new Date(link.expiresAt).toLocaleDateString();
  const verificationBadge = VERIFICATION_LABELS[agent.verificationStatus];
  const verificationColor = VERIFICATION_COLORS[agent.verificationStatus] ?? "";

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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="max-w-md mx-auto">

        {/* Agent branding */}
        <div className="text-center mb-8">
          {agent.logoUrl ? (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agent.logoUrl}
                alt={agent.agencyName ?? agent.displayName}
                className="h-14 w-auto object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Lock className="w-7 h-7 text-white" />
            </div>
          )}

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Secure Submission
          </p>
          <h1 className="text-xl font-bold text-slate-900">
            {agent.displayName}
            {agent.agencyName && (
              <span className="font-normal text-slate-500"> · {agent.agencyName}</span>
            )}
          </h1>

          {/* Industry + company */}
          {(agent.industry || agent.company) && (
            <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {[agent.company, agent.industry].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Verification badge */}
          {verificationBadge && (
            <div className="flex justify-center mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${verificationColor}`}>
                <BadgeCheck className="w-3.5 h-3.5" />
                {verificationBadge}
              </span>
            </div>
          )}

          {/* License number */}
          {agent.licenseNumber && (
            <p className="text-xs text-slate-400 mt-1.5">License #{agent.licenseNumber}</p>
          )}

          {/* Destination label */}
          {agent.destinationLabel && (
            <p className="text-xs text-slate-400 mt-1.5">
              Data sent to: <span className="text-slate-600 font-medium">{agent.destinationLabel}</span>
            </p>
          )}
        </div>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-6 mb-8">
          {[
            { icon: Lock, label: "AES-256" },
            { icon: Shield, label: "Private" },
            { icon: Clock, label: `Expires ${expiresDate}` },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Form title */}
          <h2 className="text-base font-semibold text-slate-900 mb-1">{form.title}</h2>
          {form.description && (
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">{form.description}</p>
          )}
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">
            Enter your information below. This goes directly and privately to {agent.displayName}.
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
              This link cannot be reused after submission. Your information goes directly to {agent.displayName} and is not shared with third parties.
            </p>
          </form>
        </div>
      </div>
    </main>
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
  const inputType = (() => {
    if (field.maskInput) return "password";
    if (field.fieldType === "email") return "email";
    if (field.fieldType === "phone") return "tel";
    if (field.fieldType === "date") return "date";
    return "text";
  })();

  const inputMode = (() => {
    if (field.fieldType === "ssn" || field.fieldType === "routing" || field.fieldType === "bank_account") return "numeric" as const;
    return undefined;
  })();

  const maxLength = (() => {
    if (field.fieldType === "ssn") return 11;
    if (field.fieldType === "routing") return 9;
    return undefined;
  })();

  const autoComplete = (() => {
    if (field.fieldType === "email") return "email";
    if (field.fieldType === "phone") return "tel";
    if (field.fieldType === "address") return "street-address";
    if (field.fieldType === "ssn" || field.fieldType === "bank_account" || field.fieldType === "routing") return "off";
    return undefined;
  })();

  if (field.fieldType === "signature") {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <SignaturePad
          value={value}
          onChange={onChange}
          error={!!error}
        />
      </FieldWrapper>
    );
  }

  if (field.fieldType === "dropdown" && field.dropdownOptions) {
    return (
      <FieldWrapper label={field.label} required={field.required} error={error} hint={field.helpText ?? undefined}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            error ? "border-red-400 focus-visible:ring-red-400" : "border-input"
          }`}
          required={field.required}
        >
          <option value="">
            {field.placeholder ?? "Select an option"}
          </option>
          {field.dropdownOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </FieldWrapper>
    );
  }

  return (
    <>
      <FieldWrapper label={field.label} required={field.required} error={error} hint={!field.confirmField ? (field.helpText ?? undefined) : undefined}>
        <Input
          type={inputType}
          inputMode={inputMode}
          value={value}
          onChange={(e) => {
            let v = e.target.value;
            if (field.fieldType === "routing" || field.fieldType === "bank_account") {
              v = v.replace(/\D/g, "");
            }
            if (maxLength) v = v.slice(0, maxLength);
            onChange(v);
          }}
          placeholder={field.placeholder ?? undefined}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={field.required}
          className={error ? "border-red-400 focus-visible:ring-red-400" : ""}
        />
      </FieldWrapper>

      {field.confirmField && (
        <FieldWrapper
          label={`Confirm ${field.label}`}
          required={field.required}
          error={confirmError}
          hint={field.helpText ?? undefined}
        >
          <Input
            type={inputType}
            inputMode={inputMode}
            value={confirmValue}
            onChange={(e) => {
              let v = e.target.value;
              if (field.fieldType === "routing" || field.fieldType === "bank_account") {
                v = v.replace(/\D/g, "");
              }
              if (maxLength) v = v.slice(0, maxLength);
              onConfirmChange(v);
            }}
            placeholder={`Re-enter ${field.label.toLowerCase()}`}
            autoComplete="off"
            maxLength={maxLength}
            required={field.required}
            className={confirmError ? "border-red-400 focus-visible:ring-red-400" : ""}
          />
        </FieldWrapper>
      )}
    </>
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
      <div className={`relative border-2 rounded-xl overflow-hidden bg-white ${error ? "border-red-400" : "border-slate-200"}`}>
        <canvas
          ref={canvasRef}
          width={380}
          height={120}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && !value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-slate-400">Draw your signature here</p>
          </div>
        )}
      </div>
      {hasDrawn && (
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}
