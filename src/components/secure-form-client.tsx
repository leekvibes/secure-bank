"use client";

import { useState } from "react";
import { Lock, Shield, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

interface Props {
  token: string;
  linkType: string;
  agentName: string;
  agencyName: string | null;
  clientName: string | null;
  expiresAt: string;
}

export function SecureFormClient({
  token,
  linkType,
  agentName,
  agencyName,
  clientName,
  expiresAt,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [routingInfo, setRoutingInfo] = useState<string | null>(null);
  const [checkingRouting, setCheckingRouting] = useState(false);

  // Form state — combined for all types
  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    fullName: clientName ?? "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    preferredDraftDate: "",
    dateOfBirth: "",
    ssn: "",
    confirmSsn: "",
    address: "",
    phone: "",
    email: "",
    beneficiaryName: "",
    beneficiaryRelationship: "",
    consent: false,
  });

  function set(key: string, value: string | boolean) {
    setFields((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  async function lookupRouting(value: string) {
    if (value.length !== 9) { setRoutingInfo(null); return; }
    setCheckingRouting(true);
    try {
      const res = await fetch(`/api/routing?number=${value}`);
      const data = await res.json();
      if (data.name) {
        setRoutingInfo(data.name);
        set("bankName", data.name);
      } else {
        setRoutingInfo(null);
      }
    } catch {
      setRoutingInfo(null);
    } finally {
      setCheckingRouting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const body: Record<string, string | boolean> = { consent: fields.consent };

    if (linkType === "BANKING_INFO") {
      Object.assign(body, {
        fullName: fields.fullName,
        bankName: fields.bankName,
        routingNumber: fields.routingNumber,
        accountNumber: fields.accountNumber,
        preferredDraftDate: fields.preferredDraftDate,
      });
    } else if (linkType === "SSN_ONLY") {
      Object.assign(body, {
        firstName: fields.firstName,
        lastName: fields.lastName,
        ssn: fields.ssn,
        confirmSsn: fields.confirmSsn,
      });
    } else if (linkType === "SSN_DOB") {
      Object.assign(body, {
        fullName: fields.fullName,
        dateOfBirth: fields.dateOfBirth,
        ssn: fields.ssn,
      });
    } else if (linkType === "FULL_INTAKE") {
      Object.assign(body, {
        fullName: fields.fullName,
        dateOfBirth: fields.dateOfBirth,
        ssn: fields.ssn,
        address: fields.address,
        phone: fields.phone,
        email: fields.email,
        beneficiaryName: fields.beneficiaryName,
        beneficiaryRelationship: fields.beneficiaryRelationship,
        bankName: fields.bankName,
        routingNumber: fields.routingNumber,
        accountNumber: fields.accountNumber,
        preferredDraftDate: fields.preferredDraftDate,
      });
    }

    const res = await fetch(`/api/secure/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.fieldErrors) {
        setFieldErrors(data.fieldErrors);
      }
      setError(data.error ?? "Submission failed. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Submitted securely
          </h1>
          <p className="text-slate-500 leading-relaxed mb-6">
            Your information has been encrypted and securely delivered to{" "}
            {agentName}. You can close this page.
          </p>
          <div className="bg-white rounded-xl border border-slate-100 p-4 text-sm text-slate-500 text-left space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Encrypted with AES-256 before storage</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Never shared with third parties</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Automatically deleted after the retention period</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const showBanking = linkType === "BANKING_INFO" || linkType === "FULL_INTAKE";
  const showSsnDob = linkType === "SSN_DOB" || linkType === "FULL_INTAKE";
  const showSsnOnly = linkType === "SSN_ONLY";
  const showPersonal = linkType === "FULL_INTAKE";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-md mx-auto">
        {/* Header trust section */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Secure Submission
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {agentName}
            {agencyName ? ` · ${agencyName}` : ""} is requesting your
            information privately. You don&apos;t need to read anything aloud.
          </p>
        </div>

        {/* Trust badges */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-6">
          <div className="grid grid-cols-1 gap-2.5 text-sm text-slate-600">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Encrypted end-to-end with AES-256</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                This link expires {formatDate(expiresAt)}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Only your agent can view your submission</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Not stored longer than necessary</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {showSsnOnly ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" error={fieldErrors.firstName} required>
                  <Input
                    value={fields.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last name" error={fieldErrors.lastName} required>
                  <Input
                    value={fields.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                  />
                </Field>
              </div>
            ) : (
              <Field label="Full name" error={fieldErrors.fullName} required>
                <Input
                  value={fields.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Your full legal name"
                  autoComplete="name"
                />
              </Field>
            )}

            {showSsnOnly && (
              <>
                <Field
                  label="Social Security Number"
                  error={fieldErrors.ssn}
                  required
                  hint="Format: XXX-XX-XXXX"
                >
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={fields.ssn}
                    onChange={(e) => set("ssn", e.target.value)}
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Confirm SSN"
                  error={fieldErrors.confirmSsn}
                  required
                >
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={fields.confirmSsn}
                    onChange={(e) => set("confirmSsn", e.target.value)}
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                    autoComplete="off"
                  />
                </Field>
              </>
            )}

            {showPersonal && (
              <>
                <Field label="Address" error={fieldErrors.address} required>
                  <Input
                    value={fields.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="123 Main St, City, State 00000"
                    autoComplete="street-address"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone" error={fieldErrors.phone} required>
                    <Input
                      type="tel"
                      value={fields.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="555-000-0000"
                      autoComplete="tel"
                    />
                  </Field>
                  <Field label="Email" error={fieldErrors.email} required>
                    <Input
                      type="email"
                      value={fields.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                    />
                  </Field>
                </div>
              </>
            )}

            {showSsnDob && (
              <>
                <Field label="Date of birth" error={fieldErrors.dateOfBirth} required>
                  <Input
                    type="date"
                    value={fields.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </Field>
                <Field
                  label="Social Security Number"
                  error={fieldErrors.ssn}
                  required
                  hint="Format: XXX-XX-XXXX"
                >
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={fields.ssn}
                    onChange={(e) => set("ssn", e.target.value)}
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                    autoComplete="off"
                  />
                </Field>
              </>
            )}

            {showPersonal && (
              <>
                <Field label="Beneficiary name" error={fieldErrors.beneficiaryName}>
                  <Input
                    value={fields.beneficiaryName}
                    onChange={(e) => set("beneficiaryName", e.target.value)}
                    placeholder="Full name (optional)"
                  />
                </Field>
                <Field label="Beneficiary relationship" error={fieldErrors.beneficiaryRelationship}>
                  <Input
                    value={fields.beneficiaryRelationship}
                    onChange={(e) => set("beneficiaryRelationship", e.target.value)}
                    placeholder="e.g. Spouse, Child (optional)"
                  />
                </Field>
              </>
            )}

            {showBanking && (
              <>
                <Field
                  label="Routing number"
                  error={fieldErrors.routingNumber}
                  required
                  hint={
                    checkingRouting
                      ? "Looking up bank..."
                      : routingInfo
                      ? `Bank: ${routingInfo}`
                      : "9-digit number from your check"
                  }
                >
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={fields.routingNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                      set("routingNumber", v);
                      lookupRouting(v);
                    }}
                    placeholder="021000021"
                    maxLength={9}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Bank name" error={fieldErrors.bankName}>
                  <Input
                    value={fields.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    placeholder="Auto-filled from routing number"
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Account number"
                  error={fieldErrors.accountNumber}
                  required
                >
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={fields.accountNumber}
                    onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))}
                    placeholder="Your account number"
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Preferred draft date"
                  error={fieldErrors.preferredDraftDate}
                  required
                  hint="Day of month for automatic payments (e.g. 1st, 15th)"
                >
                  <Input
                    value={fields.preferredDraftDate}
                    onChange={(e) => set("preferredDraftDate", e.target.value)}
                    placeholder="e.g. 1st, 15th, or any day"
                  />
                </Field>
              </>
            )}

            {/* Consent */}
            <div className="pt-2">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-sm text-slate-600 leading-relaxed">
                    I consent to submit this information to {agentName}
                    {agencyName ? ` (${agencyName})` : ""} through this secure
                    link. I understand this data will be encrypted, retained
                    for a limited period, and used solely to complete my
                    request.
                  </span>
                </label>
                {fieldErrors.consent && (
                  <p className="text-xs text-red-600 mt-2">{fieldErrors.consent}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !fields.consent}
            >
              {loading ? "Submitting..." : "Submit securely"}
            </Button>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              This form is encrypted. Your information goes directly to your
              agent and is not shared with any third party. This secure link
              cannot be reused after submission.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  error,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
