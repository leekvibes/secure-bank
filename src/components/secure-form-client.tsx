"use client";

import { useState, useRef } from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientTrustHeader, type AgentProfile } from "@/components/client-trust-header";
import { getErrorMessage, getFieldErrors } from "@/lib/error-message";

function fmtSsn(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 15);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}${d.length > 10 ? ` ${d.slice(10)}` : ""}`;
}

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_MIMES = new Set(["image/jpeg", "image/png", "application/pdf"]);

interface Props {
  token: string;
  linkType: string;
  linkOptions?: Record<string, unknown>;
  agent: AgentProfile;
  logoUrls: string[];
  clientName: string | null;
  expiresAt: string;
}

export function SecureFormClient({
  token,
  linkType,
  linkOptions,
  agent,
  logoUrls,
  clientName,
  expiresAt,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [routingInfo, setRoutingInfo] = useState<string | null>(null);
  const [checkingRouting, setCheckingRouting] = useState(false);

  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    fullName: clientName ?? "",
    middleInitial: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    confirmAccountNumber: "",
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

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [showSsn, setShowSsn] = useState(false);
  const [showConfirmSsn, setShowConfirmSsn] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showConfirmAccount, setShowConfirmAccount] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);
  const middleInitialEnabled =
    linkType === "BANKING_INFO" &&
    (Boolean(linkOptions?.middleInitialEnabled) || Boolean(linkOptions?.requireMiddleInitial));

  function set(key: string, value: string | boolean) {
    setFields((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  const ssnMismatch =
    linkType === "SSN_ONLY" &&
    fields.ssn.length > 0 &&
    fields.confirmSsn.length > 0 &&
    fields.ssn.replace(/\D/g, "") !== fields.confirmSsn.replace(/\D/g, "");

  const accountMismatch =
    (linkType === "BANKING_INFO" || linkType === "FULL_INTAKE") &&
    fields.accountNumber.length > 0 &&
    fields.confirmAccountNumber.length > 0 &&
    fields.accountNumber !== fields.confirmAccountNumber;

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
    if (loading || submitted || submitLockRef.current) return;
    submitLockRef.current = true;
    setLoading(true);
    setError(null);
    setFieldErrors({});

    if (linkType === "ID_UPLOAD") {
      await handleIdUpload();
      return;
    }

    const body: Record<string, string | boolean> = { consent: fields.consent };

    if (linkType === "BANKING_INFO") {
      Object.assign(body, {
        fullName: fields.fullName,
        ...(middleInitialEnabled ? { middleInitial: fields.middleInitial } : {}),
        bankName: fields.bankName,
        routingNumber: fields.routingNumber,
        accountNumber: fields.accountNumber,
        confirmAccountNumber: fields.confirmAccountNumber,
        preferredDraftDate: fields.preferredDraftDate,
      });
    } else if (linkType === "SSN_ONLY") {
      Object.assign(body, {
        firstName: fields.firstName,
        lastName: fields.lastName,
        ssn: fields.ssn,
        confirmSsn: fields.confirmSsn,
      });
    } else if (linkType === "FULL_INTAKE") {
      Object.assign(body, {
        fullName: fields.fullName,
        middleInitial: fields.middleInitial,
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
        confirmAccountNumber: fields.confirmAccountNumber,
        preferredDraftDate: fields.preferredDraftDate,
      });
    }

    const res = await fetch(`/api/secure/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const parsedFieldErrors = getFieldErrors(data);
      if (Object.keys(parsedFieldErrors).length > 0) setFieldErrors(parsedFieldErrors);
      setError(getErrorMessage(data, "Submission failed. Please try again."));
      setLoading(false);
      submitLockRef.current = false;
      return;
    }
    setSubmitted(true);
  }

  async function handleIdUpload() {
    if (!frontFile) {
      setFieldErrors({ front: "Front of ID is required." });
      setLoading(false);
      submitLockRef.current = false;
      return;
    }
    if (!fields.consent) {
      setFieldErrors({ consent: "You must consent to submit." });
      setLoading(false);
      submitLockRef.current = false;
      return;
    }

    const formData = new FormData();
    formData.append("front", frontFile);
    if (backFile) formData.append("back", backFile);

    const res = await fetch(`/api/id-uploads?token=${token}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      setError(getErrorMessage(data, "Upload failed. Please try again."));
      setLoading(false);
      submitLockRef.current = false;
      return;
    }
    setSubmitted(true);
  }

  function validateUploadSelection(file: File | null): string | null {
    if (!file) return null;
    if (file.size > MAX_UPLOAD_SIZE_BYTES) return "File exceeds 5MB limit.";
    if (!ALLOWED_UPLOAD_MIMES.has(file.type)) {
      return "Only JPG, PNG, or PDF files are allowed.";
    }
    return null;
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center animate-fade-in">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Submitted securely</h1>
          <p className="text-slate-400 leading-relaxed mb-8">
            Your information has been encrypted and delivered to {agent.displayName}. You can close this page.
          </p>
          <div className="bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm p-5 text-sm text-slate-400 text-left space-y-3">
            {[
              "Encrypted with AES-256 before storage",
              "Delivered only to your agent",
              "Automatically deleted after the retention period",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <ClientTrustHeader logoUrls={logoUrls} agent={agent} expiresAt={expiresAt} isViewOnce />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-sm mx-auto animate-fade-in">
          <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 shadow-xl shadow-black/20 p-6">
            <p className="text-sm text-slate-400 mb-5 leading-relaxed">
              Enter your information below to securely submit your personal information. Nothing is read aloud -- this form is end-to-end encrypted.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {linkType === "SSN_ONLY" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name" error={fieldErrors.firstName} required>
                      <Input value={fields.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First" autoComplete="given-name" />
                    </Field>
                    <Field label="Last name" error={fieldErrors.lastName} required>
                      <Input value={fields.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last" autoComplete="family-name" />
                    </Field>
                  </div>
                  <Field label="Social Security Number" error={fieldErrors.ssn} required hint="Auto-formats as XXX-XX-XXXX">
                    <Input
                      type={showSsn ? "text" : "password"}
                      inputMode="numeric"
                      value={fields.ssn}
                      onChange={(e) => set("ssn", fmtSsn(e.target.value))}
                      placeholder="XXX-XX-XXXX"
                      maxLength={11}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSsn((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showSsn ? "Hide SSN" : "Show SSN"}
                    </button>
                  </Field>
                  <Field
                    label="Confirm SSN"
                    error={fieldErrors.confirmSsn ?? (ssnMismatch ? "SSN values do not match." : undefined)}
                    required
                  >
                    <Input
                      type={showConfirmSsn ? "text" : "password"}
                      inputMode="numeric"
                      value={fields.confirmSsn}
                      onChange={(e) => set("confirmSsn", fmtSsn(e.target.value))}
                      placeholder="Re-enter SSN"
                      maxLength={11}
                      autoComplete="off"
                      className={ssnMismatch ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmSsn((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showConfirmSsn ? "Hide SSN" : "Show SSN"}
                    </button>
                  </Field>
                </>
              )}

              {linkType === "BANKING_INFO" && (
                <>
                  <Field label="Full name" error={fieldErrors.fullName} required>
                    <Input value={fields.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Your full legal name" autoComplete="name" />
                  </Field>
                  {middleInitialEnabled && (
                    <Field label="Middle initial" error={fieldErrors.middleInitial} required hint="Single letter (A-Z)">
                      <Input
                        value={fields.middleInitial}
                        onChange={(e) =>
                          set(
                            "middleInitial",
                            e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase()
                          )
                        }
                        placeholder="A"
                        autoComplete="additional-name"
                        maxLength={1}
                      />
                    </Field>
                  )}
                  <Field
                    label="Routing number"
                    error={fieldErrors.routingNumber}
                    required
                    hint={checkingRouting ? "Looking up bank..." : routingInfo ? `Bank: ${routingInfo}` : "9-digit number from your check"}
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
                    <Input value={fields.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="Auto-filled from routing number" autoComplete="off" />
                  </Field>
                  <Field label="Account number" error={fieldErrors.accountNumber} required>
                    <Input
                      type={showAccount ? "text" : "password"}
                      inputMode="numeric"
                      value={fields.accountNumber}
                      onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))}
                      placeholder="Your account number"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccount((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showAccount ? "Hide account number" : "Show account number"}
                    </button>
                  </Field>
                  <Field
                    label="Confirm account number"
                    error={fieldErrors.confirmAccountNumber ?? (accountMismatch ? "Account numbers do not match." : undefined)}
                    required
                  >
                    <Input
                      type={showConfirmAccount ? "text" : "password"}
                      inputMode="numeric"
                      value={fields.confirmAccountNumber}
                      onChange={(e) => set("confirmAccountNumber", e.target.value.replace(/\D/g, ""))}
                      placeholder="Re-enter account number"
                      autoComplete="off"
                      className={accountMismatch ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmAccount((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showConfirmAccount ? "Hide account number" : "Show account number"}
                    </button>
                  </Field>
                  <Field label="Preferred draft date" error={fieldErrors.preferredDraftDate} required hint="Day of month for automatic payments (e.g. 1st, 15th)">
                    <Input value={fields.preferredDraftDate} onChange={(e) => set("preferredDraftDate", e.target.value)} placeholder="e.g. 1st, 15th, or any day" />
                  </Field>
                </>
              )}

              {linkType === "FULL_INTAKE" && (
                <>
                  <Field label="Full name" error={fieldErrors.fullName} required>
                    <Input value={fields.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Your full legal name" autoComplete="name" />
                  </Field>
                  <Field label="Date of birth" error={fieldErrors.dateOfBirth} required>
                    <Input type="date" value={fields.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} max={new Date().toISOString().split("T")[0]} />
                  </Field>
                  <Field label="Social Security Number" error={fieldErrors.ssn} required hint="Auto-formats as XXX-XX-XXXX">
                    <Input type={showSsn ? "text" : "password"} inputMode="numeric" value={fields.ssn} onChange={(e) => set("ssn", fmtSsn(e.target.value))} placeholder="XXX-XX-XXXX" maxLength={11} autoComplete="off" />
                    <button
                      type="button"
                      onClick={() => setShowSsn((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showSsn ? "Hide SSN" : "Show SSN"}
                    </button>
                  </Field>
                  <Field label="Address" error={fieldErrors.address} required>
                    <Input value={fields.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, City, State 00000" autoComplete="street-address" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone" error={fieldErrors.phone} required>
                      <Input type="tel" value={fields.phone} onChange={(e) => set("phone", fmtPhone(e.target.value))} placeholder="(555) 000-0000" autoComplete="tel" />
                    </Field>
                    <Field label="Email" error={fieldErrors.email} required>
                      <Input type="email" value={fields.email} onChange={(e) => set("email", e.target.value)} placeholder="you@email.com" autoComplete="email" />
                    </Field>
                  </div>
                  <Field label="Beneficiary name" error={fieldErrors.beneficiaryName}>
                    <Input value={fields.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)} placeholder="Full name (optional)" />
                  </Field>
                  <Field label="Beneficiary relationship" error={fieldErrors.beneficiaryRelationship}>
                    <Input value={fields.beneficiaryRelationship} onChange={(e) => set("beneficiaryRelationship", e.target.value)} placeholder="e.g. Spouse, Child (optional)" />
                  </Field>
                  <Field label="Routing number" error={fieldErrors.routingNumber} required hint={checkingRouting ? "Looking up..." : routingInfo ? `Bank: ${routingInfo}` : "9-digit number"}>
                    <Input type="text" inputMode="numeric" value={fields.routingNumber} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 9); set("routingNumber", v); lookupRouting(v); }} placeholder="021000021" maxLength={9} autoComplete="off" />
                  </Field>
                  <Field label="Bank name" error={fieldErrors.bankName}>
                    <Input value={fields.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="Auto-filled from routing number" autoComplete="off" />
                  </Field>
                  <Field label="Account number" error={fieldErrors.accountNumber} required>
                    <Input type={showAccount ? "text" : "password"} inputMode="numeric" value={fields.accountNumber} onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))} placeholder="Your account number" autoComplete="off" />
                    <button
                      type="button"
                      onClick={() => setShowAccount((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showAccount ? "Hide account number" : "Show account number"}
                    </button>
                  </Field>
                  <Field label="Confirm account number" error={fieldErrors.confirmAccountNumber ?? (accountMismatch ? "Account numbers do not match." : undefined)} required>
                    <Input type={showConfirmAccount ? "text" : "password"} inputMode="numeric" value={fields.confirmAccountNumber} onChange={(e) => set("confirmAccountNumber", e.target.value.replace(/\D/g, ""))} placeholder="Re-enter account number" autoComplete="off" className={accountMismatch ? "border-red-500/50 focus-visible:ring-red-500/30" : ""} />
                    <button
                      type="button"
                      onClick={() => setShowConfirmAccount((v) => !v)}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                    >
                      {showConfirmAccount ? "Hide account number" : "Show account number"}
                    </button>
                  </Field>
                  <Field label="Preferred draft date" error={fieldErrors.preferredDraftDate} required>
                    <Input value={fields.preferredDraftDate} onChange={(e) => set("preferredDraftDate", e.target.value)} placeholder="e.g. 1st, 15th" />
                  </Field>
                </>
              )}

              {linkType === "ID_UPLOAD" && (
                <>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">
                      Upload a photo of your government-issued ID
                    </p>

                    <div>
                      <p className="text-xs text-slate-400 mb-1.5">Front of ID <span className="text-red-400">*</span></p>
                      {frontFile ? (
                        <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm text-slate-200 truncate block">{frontFile.name}</span>
                            <span className="text-xs text-slate-500">{(frontFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFrontFile(null);
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.front;
                                return next;
                              });
                            }}
                            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => frontRef.current?.click()}
                          className="w-full flex flex-col items-center gap-2 p-5 border-2 border-dashed border-white/10 rounded-xl hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors"
                        >
                          <Upload className="w-5 h-5 text-slate-500" />
                          <span className="text-sm text-slate-400">Tap to select front of ID</span>
                          <span className="text-xs text-slate-600">JPG, PNG, PDF - max 5 MB</span>
                        </button>
                      )}
                      <input
                        ref={frontRef}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          const uploadError = validateUploadSelection(file);
                          if (uploadError) {
                            setFieldErrors((prev) => ({ ...prev, front: uploadError }));
                            setFrontFile(null);
                            return;
                          }
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.front;
                            return next;
                          });
                          setFrontFile(file);
                        }}
                      />
                      {fieldErrors.front && <p className="text-xs text-red-400 mt-1">{fieldErrors.front}</p>}
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1.5">Back of ID <span className="text-slate-600">(optional)</span></p>
                      {backFile ? (
                        <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm text-slate-200 truncate block">{backFile.name}</span>
                            <span className="text-xs text-slate-500">{(backFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setBackFile(null);
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.back;
                                return next;
                              });
                            }}
                            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => backRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-white/10 rounded-xl hover:border-blue-500/40 transition-colors"
                        >
                          <Upload className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-400">Add back of ID</span>
                        </button>
                      )}
                      <input
                        ref={backRef}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          const uploadError = validateUploadSelection(file);
                          if (uploadError) {
                            setFieldErrors((prev) => ({ ...prev, back: uploadError }));
                            setBackFile(null);
                            return;
                          }
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.back;
                            return next;
                          });
                          setBackFile(file);
                        }}
                      />
                      {fieldErrors.back && <p className="text-xs text-red-400 mt-1">{fieldErrors.back}</p>}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-1">
                <label className="flex items-start gap-3 cursor-pointer p-4 bg-white/[0.03] rounded-xl border border-white/10 hover:bg-white/[0.05] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 accent-blue-500"
                  />
                  <span className="text-sm text-slate-400 leading-relaxed">
                    I consent to share this information with {agent.displayName}
                    {agent.agencyName ? ` (${agent.agencyName})` : ""} for the purpose of completing my application. I understand it will be encrypted, retained for a limited period, and deleted afterward.
                  </span>
                </label>
                {fieldErrors.consent && (
                  <p className="text-xs text-red-400 mt-1.5">{fieldErrors.consent}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20"
                disabled={loading || !fields.consent || ssnMismatch || accountMismatch}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit securely"
                )}
              </Button>

              <p className="text-xs text-slate-600 text-center leading-relaxed">
                This link is single-use and expires after submission. Your information is encrypted and not shared with third parties.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
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
      <Label className="text-slate-300">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
