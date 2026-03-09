"use client";

import { useState, useRef } from "react";
import { CheckCircle2, Loader2, Upload, X, Shield, Lock, ShieldCheck, Phone } from "lucide-react";
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

const LINK_TYPE_LABELS: Record<string, string> = {
  BANKING_INFO: "banking information",
  SSN_ONLY: "identity verification details",
  FULL_INTAKE: "personal and financial information",
  ID_UPLOAD: "identification document",
};

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

    const body: Record<string, string | boolean> = {};

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

    const fd = new FormData();
    fd.append("front", frontFile);
    if (backFile) fd.append("back", backFile);

    const res = await fetch(`/api/id-uploads?token=${token}`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json();

    if (!res.ok) {
      const parsedFieldErrors = getFieldErrors(data);
      if (Object.keys(parsedFieldErrors).length > 0) setFieldErrors(parsedFieldErrors);
      setError(getErrorMessage(data, "Upload failed. Please try again."));
      setLoading(false);
      submitLockRef.current = false;
      return;
    }
    setSubmitted(true);
  }

  function validateUploadSelection(file: File | null): string | undefined {
    if (!file) return undefined;
    if (!ALLOWED_UPLOAD_MIMES.has(file.type)) return "Only JPG, PNG, and PDF files are accepted.";
    if (file.size > MAX_UPLOAD_SIZE_BYTES) return "File must be under 5 MB.";
    return undefined;
  }

  const typeLabel = LINK_TYPE_LABELS[linkType] ?? "information";

  const sectionTitle =
    linkType === "BANKING_INFO" ? "Secure Banking Information" :
    linkType === "SSN_ONLY" ? "Secure Identity Verification" :
    linkType === "ID_UPLOAD" ? "Secure ID Upload" :
    "Secure Client Intake";

  const greetingLine = clientName
    ? `Hello, ${clientName}. `
    : "";
  const destinationLine = agent.destinationLabel
    ? ` Your ${agent.destinationLabel} setup requires the following details.`
    : "";
  const greetingMessage = `${greetingLine}Please complete the form below to securely submit your ${typeLabel}.${destinationLine}`;

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50/80 via-slate-50 to-white flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center animate-fade-in">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Submitted Securely</h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Your information has been encrypted and securely submitted. You may now close this page.
          </p>
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 text-sm text-gray-600 text-left space-y-3">
            {[
              "Encrypted with AES-256 before storage",
              "Delivered only to your authorized representative",
              "Securely stored and accessible only to your representative",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <span>{line}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-red-50 rounded-2xl border border-red-200 p-4 text-left">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Fraud warning</p>
            <p className="text-sm text-red-600 leading-relaxed">
              If you believe someone tried to scam you using this link or the information you submitted, call us immediately at{" "}
              <a href={`tel:${agent.phone ?? "2023024129"}`} className="font-bold underline">{agent.phone ?? "202-302-4129"}</a>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/80 via-slate-50 to-white flex flex-col">
      <ClientTrustHeader logoUrls={logoUrls} agent={agent} expiresAt={expiresAt} isViewOnce />

      <main className="flex-1 px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-md mx-auto animate-fade-in space-y-4 sm:space-y-5">

          <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
            <TrustIndicator icon={Shield} label="Bank-Level Security" />
            <TrustIndicator icon={Lock} label="256-Bit Encryption" />
            <TrustIndicator icon={ShieldCheck} label="Private & Secure" />
          </div>

          <div className="rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 sm:px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">{sectionTitle}</h2>
                  <p className="text-xs sm:text-sm text-blue-100">End-to-end encrypted</p>
                </div>
              </div>
            </div>

            <div className="bg-white px-5 sm:px-6 py-5 sm:py-6">
              <p className="text-sm text-gray-600 leading-relaxed mb-5 pb-4 border-b border-gray-100">
                {greetingMessage}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {linkType === "SSN_ONLY" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="First Name" error={fieldErrors.firstName} required>
                        <Input value={fields.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First" autoComplete="given-name" />
                      </Field>
                      <Field label="Last Name" error={fieldErrors.lastName} required>
                        <Input value={fields.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last" autoComplete="family-name" />
                      </Field>
                    </div>
                    <Field label="Social Security Number" error={fieldErrors.ssn} required hint="Formats automatically as XXX-XX-XXXX">
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
                        className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
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
                        className={ssnMismatch ? "border-red-300 focus-visible:ring-red-300" : ""}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmSsn((v) => !v)}
                        className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
                      >
                        {showConfirmSsn ? "Hide SSN" : "Show SSN"}
                      </button>
                    </Field>
                  </>
                )}

                {linkType === "BANKING_INFO" && (
                  <>
                    <Field label="Full Name" error={fieldErrors.fullName} required>
                      <Input value={fields.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Your full legal name" autoComplete="name" />
                    </Field>
                    {middleInitialEnabled && (
                      <Field label="Middle Initial" error={fieldErrors.middleInitial} required hint="Single letter (A–Z)">
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
                      label="Routing Number"
                      error={fieldErrors.routingNumber}
                      required
                      hint={checkingRouting ? "Looking up bank..." : routingInfo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Verified — {routingInfo}
                        </span>
                      ) : "9-digit number found on your check"}
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
                    <Field label="Bank Name" error={fieldErrors.bankName}>
                      <Input value={fields.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="Auto-filled from routing number" autoComplete="off" />
                    </Field>
                    <Field label="Account Number" error={fieldErrors.accountNumber} required>
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
                        className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
                      >
                        {showAccount ? "Hide account number" : "Show account number"}
                      </button>
                    </Field>
                    <Field
                      label="Confirm Account Number"
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
                        className={accountMismatch ? "border-red-300 focus-visible:ring-red-300" : ""}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmAccount((v) => !v)}
                        className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
                      >
                        {showConfirmAccount ? "Hide account number" : "Show account number"}
                      </button>
                    </Field>
                    <Field label="Preferred Draft Date" error={fieldErrors.preferredDraftDate} required hint="Day of month for automatic payments (e.g. 1st, 15th)">
                      <Input value={fields.preferredDraftDate} onChange={(e) => set("preferredDraftDate", e.target.value)} placeholder="e.g. 1st, 15th, or any day" />
                    </Field>
                  </>
                )}

                {linkType === "FULL_INTAKE" && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-sm font-semibold text-gray-700">Personal Information</span>
                        <div className="flex-1 h-px bg-blue-100" />
                      </div>
                      <Field label="Full Name" error={fieldErrors.fullName} required>
                        <Input value={fields.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Your full legal name" autoComplete="name" />
                      </Field>
                      <Field label="Date of Birth" error={fieldErrors.dateOfBirth} required>
                        <Input type="date" value={fields.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} max={new Date().toISOString().split("T")[0]} />
                      </Field>
                      <Field label="Social Security Number" error={fieldErrors.ssn} required hint="Formats automatically as XXX-XX-XXXX">
                        <Input type={showSsn ? "text" : "password"} inputMode="numeric" value={fields.ssn} onChange={(e) => set("ssn", fmtSsn(e.target.value))} placeholder="XXX-XX-XXXX" maxLength={11} autoComplete="off" />
                        <button
                          type="button"
                          onClick={() => setShowSsn((v) => !v)}
                          className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
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
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-sm font-semibold text-gray-700">Beneficiary Details</span>
                        <div className="flex-1 h-px bg-blue-100" />
                      </div>
                      <Field label="Beneficiary Name" error={fieldErrors.beneficiaryName}>
                        <Input value={fields.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)} placeholder="Full name (optional)" />
                      </Field>
                      <Field label="Beneficiary Relationship" error={fieldErrors.beneficiaryRelationship}>
                        <Input value={fields.beneficiaryRelationship} onChange={(e) => set("beneficiaryRelationship", e.target.value)} placeholder="e.g. Spouse, Child (optional)" />
                      </Field>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-sm font-semibold text-gray-700">Banking Information</span>
                        <div className="flex-1 h-px bg-blue-100" />
                      </div>
                      <Field label="Routing Number" error={fieldErrors.routingNumber} required hint={checkingRouting ? "Looking up bank..." : routingInfo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Verified — {routingInfo}
                        </span>
                      ) : "9-digit number found on your check"}>
                        <Input type="text" inputMode="numeric" value={fields.routingNumber} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 9); set("routingNumber", v); lookupRouting(v); }} placeholder="021000021" maxLength={9} autoComplete="off" />
                      </Field>
                      <Field label="Bank Name" error={fieldErrors.bankName}>
                        <Input value={fields.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="Auto-filled from routing number" autoComplete="off" />
                      </Field>
                      <Field label="Account Number" error={fieldErrors.accountNumber} required>
                        <Input type={showAccount ? "text" : "password"} inputMode="numeric" value={fields.accountNumber} onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))} placeholder="Your account number" autoComplete="off" />
                        <button
                          type="button"
                          onClick={() => setShowAccount((v) => !v)}
                          className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
                        >
                          {showAccount ? "Hide account number" : "Show account number"}
                        </button>
                      </Field>
                      <Field label="Confirm Account Number" error={fieldErrors.confirmAccountNumber ?? (accountMismatch ? "Account numbers do not match." : undefined)} required>
                        <Input type={showConfirmAccount ? "text" : "password"} inputMode="numeric" value={fields.confirmAccountNumber} onChange={(e) => set("confirmAccountNumber", e.target.value.replace(/\D/g, ""))} placeholder="Re-enter account number" autoComplete="off" className={accountMismatch ? "border-red-300 focus-visible:ring-red-300" : ""} />
                        <button
                          type="button"
                          onClick={() => setShowConfirmAccount((v) => !v)}
                          className="text-xs text-gray-400 hover:text-blue-500 mt-1 transition-colors"
                        >
                          {showConfirmAccount ? "Hide account number" : "Show account number"}
                        </button>
                      </Field>
                      <Field label="Preferred Draft Date" error={fieldErrors.preferredDraftDate} required>
                        <Input value={fields.preferredDraftDate} onChange={(e) => set("preferredDraftDate", e.target.value)} placeholder="e.g. 1st, 15th" />
                      </Field>
                    </div>
                  </>
                )}

                {linkType === "ID_UPLOAD" && (
                  <>
                    <div className="space-y-3">
                      <IdUploadInstructions documentType={String(linkOptions?.documentType ?? "DRIVERS_LICENSE")} requireBack={Boolean(linkOptions?.requireBack)} />

                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">
                          {(ID_DOC_CONFIG[String(linkOptions?.documentType ?? "DRIVERS_LICENSE")] ?? ID_DOC_CONFIG.DRIVERS_LICENSE).frontLabel}{" "}
                          <span className="text-red-500">*</span>
                        </p>
                        {frontFile ? (
                          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm text-gray-800 truncate block">{frontFile.name}</span>
                              <span className="text-xs text-gray-500">{(frontFile.size / 1024 / 1024).toFixed(2)} MB</span>
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
                              className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => frontRef.current?.click()}
                            className="w-full flex flex-col items-center gap-2 p-5 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                          >
                            <Upload className="w-5 h-5 text-blue-400" />
                            <span className="text-sm text-gray-600">Tap to select front of ID</span>
                            <span className="text-xs text-gray-400">JPG, PNG, PDF - max 5 MB</span>
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
                        {fieldErrors.front && <p className="text-xs text-red-500 mt-1">{fieldErrors.front}</p>}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">
                          Back of ID{" "}
                          {linkOptions?.requireBack
                            ? <span className="text-red-500">*</span>
                            : <span className="text-gray-400">(optional)</span>}
                        </p>
                        {backFile ? (
                          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm text-gray-800 truncate block">{backFile.name}</span>
                              <span className="text-xs text-gray-500">{(backFile.size / 1024 / 1024).toFixed(2)} MB</span>
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
                              className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => backRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                          >
                            <Upload className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-gray-600">Add back of ID</span>
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
                        {fieldErrors.back && <p className="text-xs text-red-500 mt-1">{fieldErrors.back}</p>}
                      </div>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md rounded-xl"
                  disabled={loading || ssnMismatch || accountMismatch}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Securely"
                  )}
                </Button>

                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  This is a single-use secure link. Your information is encrypted end-to-end and delivered only to your authorized representative.
                </p>
              </form>
            </div>
          </div>

          {agent.phone && (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500">
                Questions about this request?{" "}
                <a href={`tel:${agent.phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  <Phone className="w-3.5 h-3.5" />
                  Contact {agent.displayName}
                </a>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TrustIndicator({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0 ring-1 ring-blue-100">
        <Icon className="w-3.5 h-3.5 text-blue-500" />
      </div>
      <span className="font-medium">{label}</span>
    </div>
  );
}

const ID_DOC_CONFIG: Record<string, { label: string; frontLabel: string; backLabel: string; instructions: string; hasBack: boolean }> = {
  DRIVERS_LICENSE:   { label: "Driver's License / State ID",       frontLabel: "Front of ID",   backLabel: "Back of ID",   instructions: "Please upload a clear, well-lit photo of both sides of your driver's license or state ID.",   hasBack: true },
  PASSPORT:          { label: "Passport",                           frontLabel: "Photo page",    backLabel: "Back cover",   instructions: "Please upload a clear photo of the main photo/data page of your passport (the page with your picture).", hasBack: false },
  PASSPORT_CARD:     { label: "Passport Card",                      frontLabel: "Front",         backLabel: "Back",         instructions: "Please upload a clear photo of the front of your U.S. Passport Card.",                              hasBack: false },
  GREEN_CARD:        { label: "Green Card / Permanent Resident Card", frontLabel: "Front of card", backLabel: "Back of card", instructions: "Please upload clear photos of both sides of your Permanent Resident Card (Form I-551).",          hasBack: true },
  MILITARY_ID:       { label: "Military ID",                        frontLabel: "Front of card", backLabel: "Back of card", instructions: "Please upload clear photos of both sides of your military ID card.",                               hasBack: true },
  SOCIAL_SECURITY:   { label: "Social Security Card",               frontLabel: "Front of card", backLabel: "Back of card", instructions: "Please upload a clear photo of your Social Security card.",                                       hasBack: false },
  BIRTH_CERTIFICATE: { label: "Birth Certificate",                  frontLabel: "Document",      backLabel: "Back",         instructions: "Please upload a clear, complete photo or scan of your birth certificate.",                         hasBack: false },
};

function IdUploadInstructions({ documentType, requireBack }: { documentType: string; requireBack: boolean }) {
  const cfg = ID_DOC_CONFIG[documentType] ?? ID_DOC_CONFIG.DRIVERS_LICENSE;
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-blue-800 mb-1">
        Upload: {cfg.label}
      </p>
      <p className="text-sm text-blue-700 leading-relaxed">{cfg.instructions}</p>
      {requireBack && cfg.hasBack && (
        <p className="text-xs text-blue-600 mt-2 font-medium">Both sides are required for this document.</p>
      )}
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
  hint?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-gray-700 font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <div className="text-xs text-gray-400">{hint}</div>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
