"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, FileSignature, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LandingData {
  expired: boolean;
  reason?: string;
  message?: string;
  label?: string | null;
  documentTitle?: string;
  requireName?: boolean;
  requireEmail?: boolean;
  usedCount?: number;
  maxUses?: number | null;
  agent?: {
    displayName: string;
    agencyName: string | null;
    logoUrl: string | null;
  };
  agentName?: string;
  agencyName?: string | null;
}

export default function PublicSigningLandingPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LandingData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/sign/public/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData(j.data);
        else setFetchError("Failed to load signing page.");
      })
      .catch(() => setFetchError("Failed to load signing page."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleStart() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/sign/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? "Failed to start signing.");
      }
      const signingToken = (json as { data?: { token?: string } }).data?.token;
      if (!signingToken) throw new Error("Invalid response from server.");
      router.push(`/sign/${signingToken}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{fetchError ?? "Something went wrong."}</p>
        </div>
      </div>
    );
  }

  if (data.expired) {
    const agentName = data.agentName;
    const agencyName = data.agencyName;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Link unavailable</h1>
            <p className="text-sm text-muted-foreground mt-1">{data.message ?? "This signing link is no longer available."}</p>
          </div>
          {(agentName || agencyName) && (
            <p className="text-xs text-muted-foreground">
              For assistance, contact {agentName}{agencyName ? ` at ${agencyName}` : ""}.
            </p>
          )}
        </div>
      </div>
    );
  }

  const agent = data.agent!;
  const usageText =
    data.maxUses != null
      ? `${data.usedCount ?? 0} of ${data.maxUses} uses`
      : data.usedCount
        ? `${data.usedCount} ${data.usedCount === 1 ? "person has" : "people have"} signed this`
        : null;

  const canStart =
    (!data.requireName || name.trim().length > 0) &&
    (!data.requireEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Agent header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        {agent.logoUrl ? (
          <img src={agent.logoUrl} alt={agent.displayName} className="h-8 w-auto object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSignature className="w-4 h-4 text-primary" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-foreground leading-none">{agent.displayName}</p>
          {agent.agencyName && <p className="text-xs text-muted-foreground mt-0.5">{agent.agencyName}</p>}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Document card */}
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <FileSignature className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              {data.label ?? data.documentTitle}
            </h1>
            {data.label && data.documentTitle !== data.label && (
              <p className="text-sm text-muted-foreground">{data.documentTitle}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Requested by <span className="font-medium text-foreground">{agent.displayName}</span>
            </p>
            {usageText && (
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1 mt-1">
                <CheckCircle2 className="w-3 h-3" />
                {usageText}
              </div>
            )}
          </div>

          {/* Identity form */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">
                {data.requireName || data.requireEmail
                  ? "Enter your details to start signing"
                  : "Ready to sign?"}
              </h2>
              {(data.requireName || data.requireEmail) && (
                <p className="text-xs text-muted-foreground">Your information will be added to the signing record.</p>
              )}
            </div>

            {data.requireName && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="h-11"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && canStart && !submitting) void handleStart(); }}
                />
              </div>
            )}

            {data.requireEmail && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="h-11"
                  onKeyDown={(e) => { if (e.key === "Enter" && canStart && !submitting) void handleStart(); }}
                />
              </div>
            )}

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{submitError}</p>
            )}

            <Button
              className="w-full h-11 text-sm font-semibold"
              disabled={!canStart || submitting}
              onClick={() => void handleStart()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Starting…
                </>
              ) : (
                "Start Signing"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to sign this document electronically.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
