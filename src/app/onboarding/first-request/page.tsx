"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Shield, ClipboardList, Camera, ArrowRight, ArrowLeft, Loader2, User, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingShell } from "../onboarding-shell";
import { cn } from "@/lib/utils";

const REQUEST_TYPES = [
  { value: "BANKING_INFO", label: "Banking Info", desc: "Account & routing numbers", icon: CreditCard, color: "text-blue-500", bg: "bg-blue-500/8", ring: "ring-blue-500/20" },
  { value: "SSN_ONLY", label: "SSN Only", desc: "Social Security Number", icon: Shield, color: "text-violet-500", bg: "bg-violet-500/8", ring: "ring-violet-500/20" },
  { value: "FULL_INTAKE", label: "Full Intake", desc: "SSN + Banking + Personal", icon: ClipboardList, color: "text-emerald-500", bg: "bg-emerald-500/8", ring: "ring-emerald-500/20" },
  { value: "ID_UPLOAD", label: "ID Upload", desc: "Photo ID verification", icon: Camera, color: "text-orange-500", bg: "bg-orange-500/8", ring: "ring-orange-500/20" },
];

export default function FirstRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("BANKING_INFO");
  const [createdLink, setCreatedLink] = useState<{ url: string; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkType: selectedType,
          clientName: form.get("clientName") || undefined,
          clientEmail: form.get("clientEmail") || undefined,
          destinationLabel: form.get("destination") || undefined,
          expirationHours: 24,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create request.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setCreatedLink({ url: data.url, message: data.message });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (createdLink) {
    return (
      <OnboardingShell currentStep={4}>
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
              <Send className="w-7 h-7 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Request created</h1>
            <p className="text-sm text-muted-foreground">Your first secure link is ready to share.</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Secure Link</Label>
              <div className="flex gap-2">
                <Input value={createdLink.url} readOnly className="h-10 rounded-xl text-sm font-mono" />
                <Button
                  variant="outline"
                  className="h-10 rounded-xl shrink-0"
                  onClick={() => navigator.clipboard.writeText(createdLink.url)}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-primary" />
                End-to-end encrypted
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                Expires in 24 hours
              </span>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button
                onClick={() => {
                  const params = new URLSearchParams({ url: createdLink.url, message: createdLink.message });
                  router.push(`/onboarding/plan?${params.toString()}`);
                }}
                className="h-10 px-6 rounded-xl font-medium"
              >
                <span className="flex items-center gap-2">
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            </div>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell currentStep={4}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Create your first request</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Send a secure link to collect sensitive client information. Choose a request type to get started.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-6">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Request Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {REQUEST_TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = selectedType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setSelectedType(type.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                          : "border-border hover:border-primary/30 bg-white"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", type.bg)}>
                        <Icon className={cn("w-4 h-4", type.color)} />
                      </div>
                      <p className="text-sm font-medium text-foreground">{type.label}</p>
                      <p className="text-[11px] text-muted-foreground">{type.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="clientName" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Client Name
                </Label>
                <Input
                  id="clientName"
                  name="clientName"
                  placeholder="John Smith"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientEmail" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Client Email
                </Label>
                <Input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  placeholder="client@email.com"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="destination" className="text-xs font-medium text-muted-foreground">
                Destination
              </Label>
              <Input
                id="destination"
                name="destination"
                placeholder="e.g. Your company, a partner firm, internal processing"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/branding")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/success")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              </div>
              <Button type="submit" disabled={loading} className="h-10 px-6 rounded-xl font-medium">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create Request
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
