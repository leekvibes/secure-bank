"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, Mail, RefreshCw, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  email: string;
}

export function VerifyEmailClient({ email }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"waiting" | "verified" | "redirecting">("waiting");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const checkVerified = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/email-verified-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.verified) {
        setStatus("verified");
        setTimeout(() => {
          setStatus("redirecting");
          router.push("/onboarding/profile");
        }, 1500);
        return true;
      }
    } catch {
      // silently ignore network errors during polling
    }
    return false;
  }, [router]);

  // Poll every 3 seconds
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      const done = await checkVerified();
      if (!done && !stopped) {
        setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [checkVerified]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleResend() {
    setResendLoading(true);
    setResendError(null);
    setResendSuccess(false);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json();
    setResendLoading(false);
    if (!res.ok) {
      setResendError(data.error ?? "Failed to resend. Please try again.");
      return;
    }
    if (data.alreadyVerified) {
      setStatus("verified");
      setTimeout(() => router.push("/onboarding/profile"), 1200);
      return;
    }
    setResendSuccess(true);
    setCooldown(60);
    setTimeout(() => setResendSuccess(false), 5000);
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
    a + "*".repeat(Math.max(2, b.length)) + c
  );

  if (status === "verified" || status === "redirecting") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,94%)] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center ring-8 ring-emerald-500/8">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Email verified</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {status === "redirecting" ? "Taking you to your account setup..." : "Redirecting you now..."}
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,94%)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 justify-center mb-10 group">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">Secure Link</span>
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-lg p-8 text-center">

          {/* Animated envelope */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl bg-primary/8 animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
              <Mail className="w-9 h-9 text-primary" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-foreground tracking-tight mb-2">
            Check your inbox
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-1">
            We sent a verification link to
          </p>
          <p className="text-sm font-semibold text-foreground mb-6">{maskedEmail}</p>

          {/* Auto-detect indicator */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted/50 border border-border/40 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs text-muted-foreground">
              Waiting for verification — this page will advance automatically
            </span>
          </div>

          {/* Resend feedback */}
          {resendError && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-500/8 border border-red-500/15 text-sm text-red-600">
              {resendError}
            </div>
          )}
          {resendSuccess && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-sm text-emerald-700">
              Verification email resent. Check your inbox.
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleResend}
              disabled={resendLoading || cooldown > 0}
              variant="outline"
              className="w-full h-11 rounded-xl font-medium"
            >
              {resendLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </span>
              ) : cooldown > 0 ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Resend in {cooldown}s
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Resend verification email
                </span>
              )}
            </Button>

            <button
              onClick={() => checkVerified()}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1.5"
            >
              Already clicked the link?
              <span className="text-primary font-medium flex items-center gap-0.5">
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-xs text-muted-foreground/70">
            Didn&apos;t receive it? Check your spam folder.
          </p>
          <p className="text-xs text-muted-foreground/60">
            The link expires in 24 hours.
          </p>
        </div>
      </div>
    </main>
  );
}
