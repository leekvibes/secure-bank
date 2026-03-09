"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Check, Copy, Mail, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingShell } from "../onboarding-shell";

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkUrl = searchParams.get("url");
  const linkMessage = searchParams.get("message");
  const [completing, setCompleting] = useState(false);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function copyToClipboard(text: string, type: "link" | "message") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  async function completeOnboarding() {
    setCompleting(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      window.location.href = "/dashboard";
    } catch {
      window.location.href = "/dashboard";
    }
  }

  return (
    <OnboardingShell currentStep={5}>
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Your workspace is ready</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {linkUrl
              ? "Your first secure request has been created. Share it with your client using the options below."
              : "You're all set. Head to your dashboard to start sending secure requests to clients."}
          </p>
        </div>

        {linkUrl && (
          <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Your Secure Link</Label>
              <div className="flex gap-2">
                <Input value={linkUrl} readOnly className="h-10 rounded-xl text-sm font-mono" />
                <Button
                  variant="outline"
                  className="h-10 rounded-xl shrink-0"
                  onClick={() => copyToClipboard(linkUrl, "link")}
                >
                  {copied === "link" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copied === "link" ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {linkMessage && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Pre-written Message</Label>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground whitespace-pre-wrap">
                  {linkMessage}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => copyToClipboard(linkMessage, "message")}
                >
                  {copied === "message" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === "message" ? "Copied" : "Copy message"}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">What's next?</p>
                <p className="text-[11px] text-muted-foreground">Your dashboard has everything you need to manage secure requests.</p>
              </div>
            </div>
            <ul className="space-y-2 pl-11 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Create and send unlimited secure links
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Track when clients open and submit info
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                View encrypted submissions with one-click reveal
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Customize branding and compliance settings
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={completeOnboarding}
            disabled={completing}
            className="h-11 px-8 rounded-xl font-medium text-base"
          >
            {completing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
}
