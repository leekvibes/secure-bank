"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, PenLine, Hash, Calendar, User, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type FieldType = "SIGNATURE" | "INITIALS" | "DATE" | "NAME";
type Assignee = "AGENT" | "CLIENT";

interface SignField {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo: Assignee;
  value?: string;
}

const FIELD_META: Record<FieldType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; placeholder: string }> = {
  SIGNATURE: { label: "Signature",  icon: PenLine,  color: "text-blue-600",   placeholder: "Type your full name as signature" },
  INITIALS:  { label: "Initials",   icon: Hash,     color: "text-violet-600", placeholder: "Your initials (e.g. J.S.)" },
  DATE:      { label: "Date",       icon: Calendar, color: "text-emerald-600", placeholder: new Date().toLocaleDateString() },
  NAME:      { label: "Full Name",  icon: User,     color: "text-amber-600",  placeholder: "Your full legal name" },
};

interface DocData {
  id: string;
  title: string | null;
  message: string | null;
  clientName: string | null;
  expiresAt: string;
  fields: SignField[];
  agentSignData: SignField[] | null;
  agent: { displayName: string; agencyName: string | null };
  originalName: string | null;
}

export function DocSignClient({ token }: { token: string }) {
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setDoc(d.data);
          // Pre-fill date fields with today
          const defaults: Record<string, string> = {};
          d.data.fields?.filter((f: SignField) => f.assignedTo === "CLIENT" && f.type === "DATE").forEach((f: SignField) => {
            defaults[f.id] = new Date().toLocaleDateString();
          });
          setFieldValues(defaults);
        } else {
          setLoadError(d.error?.message ?? "This signing link is not available.");
        }
      })
      .catch(() => setLoadError("Failed to load document. Please check your connection."));
  }, [token]);

  const clientFields = doc?.fields.filter((f) => f.assignedTo === "CLIENT") ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;

    // Validate all client fields
    const errors: Record<string, string> = {};
    for (const f of clientFields) {
      if (!fieldValues[f.id]?.trim()) {
        errors[f.id] = `${FIELD_META[f.type].label} is required.`;
      }
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setSubmitting(true);
    setSubmitError(null);

    const signedFields: SignField[] = clientFields.map((f) => ({ ...f, value: fieldValues[f.id] ?? "" }));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: signedFields }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) { setSubmitError(data?.error?.message ?? "Signing failed. Please try again."); return; }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error && err.name === "AbortError" ? "Request timed out. Please try again." : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-200">
            <Shield className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-gray-500 text-sm">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50/80 via-slate-50 to-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Document signed</h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Your signature has been securely applied. {doc.agent.displayName} will be notified.
          </p>
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 text-sm text-gray-600 text-left space-y-3">
            {["Your signature has been encrypted and delivered", "Only the authorized agent can access this document", "This link is now inactive"].map((line) => (
              <div key={line} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <span>{line}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-8 text-xs text-gray-400">
            <Lock className="w-3 h-3" />
            Secured by <BrandLogo size="sm" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/80 via-slate-50 to-white">
      {/* Trust header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Secure Document Signing</span>
          </div>
          <div className="text-sm text-gray-500">{doc.agent.displayName}{doc.agent.agencyName ? ` · ${doc.agent.agencyName}` : ""}</div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h1 className="text-lg font-semibold text-white">{doc.title ?? "Document signing request"}</h1>
            <p className="text-blue-200 text-sm mt-0.5">From {doc.agent.displayName}</p>
          </div>

          {doc.message && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed italic">"{doc.message}"</p>
            </div>
          )}

          <div className="px-6 py-5">
            {/* Document preview */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Document: {doc.originalName ?? "document"}</p>
              <div ref={canvasRef} className="relative w-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden" style={{ minHeight: "400px" }}>
                <iframe
                  src={`/api/sign/${token}/file`}
                  className="w-full"
                  style={{ minHeight: "400px", height: "100%", pointerEvents: "none" }}
                  title="Document to sign"
                />
                {/* Show pre-filled agent fields as overlays */}
                {doc.agentSignData?.map((f) => f.value?.trim() ? (
                  <div
                    key={f.id}
                    className="absolute flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-50/80 border border-blue-200 rounded"
                    style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` }}
                  >
                    {f.value}
                  </div>
                ) : null)}
                {/* Client fields as highlighted zones */}
                {clientFields.map((f) => (
                  <div
                    key={f.id}
                    className="absolute border-2 border-dashed border-blue-400 rounded bg-blue-50/30 flex items-center justify-center"
                    style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` }}
                  >
                    <span className="text-xs text-blue-500 font-medium">{FIELD_META[f.type].label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature fields form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {clientFields.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <PenLine className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-semibold text-gray-700">Complete your fields</p>
                  </div>
                  {clientFields.map((f) => {
                    const { label, icon: Icon, color, placeholder } = FIELD_META[f.type];
                    return (
                      <div key={f.id}>
                        <label className={cn("flex items-center gap-2 text-sm font-medium mb-1.5", color)}>
                          <Icon className="w-4 h-4" />
                          {label} <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={fieldValues[f.id] ?? ""}
                          onChange={(e) => {
                            setFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }));
                            if (fieldErrors[f.id]) setFieldErrors((prev) => { const n = { ...prev }; delete n[f.id]; return n; });
                          }}
                          placeholder={placeholder}
                          className={fieldErrors[f.id] ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                        {fieldErrors[f.id] && <p className="text-xs text-red-500 mt-1">{fieldErrors[f.id]}</p>}
                        {f.type === "SIGNATURE" && (
                          <p className="text-xs text-gray-400 mt-1">Typing your name above constitutes a legal electronic signature.</p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{submitError}</div>
              )}

              <Button type="submit" disabled={submitting} className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md rounded-xl gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Signing...</> : <><PenLine className="w-4 h-4" />Sign Document</>}
              </Button>

              <p className="text-xs text-gray-400 text-center">By signing, you agree that this electronic signature is the legal equivalent of your handwritten signature.</p>
            </form>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          Secured by <BrandLogo size="sm" />
        </div>
      </main>
    </div>
  );
}
