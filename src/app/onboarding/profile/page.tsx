"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Briefcase, Phone, Mail, FileText, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingShell } from "../onboarding-shell";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          displayName: form.get("displayName") || undefined,
          agencyName: form.get("agencyName") || undefined,
          industry: form.get("industry") || undefined,
          phone: form.get("phone") || undefined,
          notificationEmail: form.get("supportEmail") || undefined,
          licenseNumber: form.get("licenseNumber") || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save profile.");
        setLoading(false);
        return;
      }
      router.push("/onboarding/trust");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <OnboardingShell currentStep={1}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Set up your profile</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Help clients recognize and trust you. This information appears on your secure requests.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-6">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="agencyName" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Company / Agency
                </Label>
                <Input
                  id="agencyName"
                  name="agencyName"
                  placeholder="Rivera Financial Group"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  Industry
                </Label>
                <Input
                  id="industry"
                  name="industry"
                  placeholder="Life Insurance, Medicare..."
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supportEmail" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Support Email
                </Label>
                <Input
                  id="supportEmail"
                  name="supportEmail"
                  type="email"
                  placeholder="support@agency.com"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="licenseNumber" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                License / Company ID
              </Label>
              <Input
                id="licenseNumber"
                name="licenseNumber"
                placeholder="NPN, License #, or Company ID"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Verification Status: Unverified</p>
                <p className="text-[11px] text-muted-foreground">You can upgrade your verification level in Settings after setup.</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => router.push("/onboarding/trust")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
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
