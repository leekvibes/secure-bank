"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Briefcase, Phone, Mail, FileText, MapPin, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/info-tip";
import { OnboardingShell } from "../onboarding-shell";
import { INDUSTRIES } from "@/lib/industries";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [industry, setIndustry] = useState("");
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      const licenseNumber = form.get("licenseNumber") as string;
      const licensedStates = form.get("licensedStates") as string;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyName: form.get("agencyName") || undefined,
          industry: industry || undefined,
          phone: form.get("phone") || undefined,
          notificationEmail: form.get("supportEmail") || undefined,
          licenseNumber: licenseNumber || undefined,
          licensedStates: licensedStates || undefined,
          verificationStatus: isLicensed && licenseNumber ? "LICENSED" : "UNVERIFIED",
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
            <div className="space-y-1.5">
              <Label htmlFor="agencyName" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Company / Agency
                <InfoTip text="Your company or agency name is shown to clients on secure requests so they know who is asking for their information." />
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
                <InfoTip text="Selecting your industry helps us tailor the experience and helps clients understand what type of professional you are." />
              </Label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
              >
                <option value="">Select your industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Phone Number
                  <InfoTip text="Your phone number can be displayed on secure requests so clients can contact you with questions." />
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
                  <InfoTip text="This email receives notifications when a client submits information. If left blank, your account email is used." />
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

            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Are you a licensed professional?
                <InfoTip text="If you hold a professional license (insurance, financial, etc.), providing your license number adds a 'Licensed' trust badge to your secure requests." />
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLicensed(true)}
                  className={cn(
                    "flex-1 h-10 rounded-xl text-sm font-medium border transition-all",
                    isLicensed === true
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-foreground border-border hover:border-primary/40"
                  )}
                >
                  Yes, I'm licensed
                </button>
                <button
                  type="button"
                  onClick={() => setIsLicensed(false)}
                  className={cn(
                    "flex-1 h-10 rounded-xl text-sm font-medium border transition-all",
                    isLicensed === false
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-foreground border-border hover:border-primary/40"
                  )}
                >
                  No
                </button>
              </div>
              {isLicensed && (
                <div className="animate-fade-in space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="licenseNumber" className="text-xs font-medium text-muted-foreground">
                        License / ID Number
                      </Label>
                      <Input
                        id="licenseNumber"
                        name="licenseNumber"
                        placeholder="NPN, License #, or Company ID"
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="licensedStates" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        Licensed States
                      </Label>
                      <Input
                        id="licensedStates"
                        name="licensedStates"
                        placeholder="CA, TX, FL"
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Providing your license number adds a verified trust badge visible to your clients.</p>
                </div>
              )}
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
