"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Timer, MessageSquare, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/info-tip";
import { OnboardingShell } from "../onboarding-shell";

const RETENTION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: -1, label: "Manual delete only" },
];

const EXPIRATION_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 6, label: "6 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
];

export default function TrustPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retention, setRetention] = useState(30);
  const [expiration, setExpiration] = useState(24);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationLabel: form.get("destinationLabel") || undefined,
          dataRetentionDays: retention,
          defaultExpirationHours: expiration,
          trustMessage: form.get("trustMessage") || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save settings.");
        setLoading(false);
        return;
      }
      router.push("/onboarding/branding");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <OnboardingShell currentStep={2}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Trust settings</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Configure how your secure requests behave. These defaults apply to every new link you create.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-6">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="destinationLabel" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Where does client data go?
                <InfoTip text="This label is shown to your clients so they know exactly where their sensitive information is being submitted, like a company or partner name." />
              </Label>
              <Input
                id="destinationLabel"
                name="destinationLabel"
                placeholder="e.g. Your company, a partner firm, internal processing"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Data Retention
                <InfoTip text="How long client submissions are stored before being automatically deleted. Shorter retention is more secure. 'Manual only' means you delete data yourself when you're done with it." />
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRetention(opt.value)}
                    className={`h-10 rounded-xl text-xs font-medium border transition-all ${
                      retention === opt.value
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Default Link Expiration
                <InfoTip text="How long each secure link stays active before it expires and can no longer be used. Shorter times are more secure. You can override this per link." />
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpiration(opt.value)}
                    className={`h-10 rounded-xl text-xs font-medium border transition-all ${
                      expiration === opt.value
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trustMessage" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Default Trust Message
                <InfoTip text="A personal message shown on your secure request page. Use it to reassure clients about how their data will be handled and invite them to contact you with questions." />
              </Label>
              <textarea
                id="trustMessage"
                name="trustMessage"
                rows={3}
                placeholder="e.g. Your information is encrypted end-to-end and will only be used for your service needs. Feel free to reach out if you have any questions."
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/profile")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/branding")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              </div>
              <Button type="submit" disabled={loading} className="h-10 px-6 rounded-xl font-medium">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </OnboardingShell>
  );
}
