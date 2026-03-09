"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ExternalLink, Upload, X, Loader2, UserCircle, User, Camera,
  Building2, Briefcase, Phone, Mail, FileText, ShieldCheck,
  MapPin, Clock, Timer, MessageSquare, Lock, Shield, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  user: {
    displayName: string;
    agencyName: string | null;
    company: string | null;
    phone: string | null;
    licenseNumber: string | null;
    licensedStates: string | null;
    agentSlug: string;
    email: string;
    logoUrl: string | null;
    photoUrl: string | null;
    industry: string | null;
    destinationLabel: string | null;
    carriersList: string | null;
    notificationEmail: string | null;
    verificationStatus: string;
    dataRetentionDays: number;
    trustMessage: string | null;
    defaultExpirationHours: number;
  };
}

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "branding", label: "Branding" },
  { key: "client", label: "Client Experience" },
  { key: "trust", label: "Trust & Security" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const RETENTION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: -1, label: "Manual only" },
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

export function SettingsForm({ user }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(user.logoUrl);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(user.photoUrl);

  const [form, setForm] = useState({
    displayName: user.displayName,
    agencyName: user.agencyName ?? "",
    company: user.company ?? "",
    phone: user.phone ?? "",
    licenseNumber: user.licenseNumber ?? "",
    licensedStates: user.licensedStates ?? "",
    industry: user.industry ?? "",
    destinationLabel: user.destinationLabel ?? "",
    carriersList: user.carriersList ?? "",
    notificationEmail: user.notificationEmail ?? "",
    verificationStatus: user.verificationStatus ?? "UNVERIFIED",
    dataRetentionDays: user.dataRetentionDays ?? 30,
    trustMessage: user.trustMessage ?? "",
    defaultExpirationHours: user.defaultExpirationHours ?? 24,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }

    setSuccess(true);
    router.refresh();
    setTimeout(() => setSuccess(false), 3000);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setLogoError("Logo must be under 512 KB.");
      return;
    }
    setLogoUploading(true);
    setLogoError(null);
    const fd = new FormData();
    fd.append("logo", file);
    const res = await fetch("/api/agent/logo", { method: "POST", body: fd });
    const data = await res.json();
    setLogoUploading(false);
    if (!res.ok) { setLogoError(data.error ?? "Upload failed."); return; }
    setCurrentLogoUrl(data.logoUrl);
    router.refresh();
  }

  async function handleLogoDelete() {
    setLogoUploading(true);
    await fetch("/api/agent/logo", { method: "DELETE" });
    setCurrentLogoUrl(null);
    setLogoUploading(false);
    router.refresh();
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setPhotoError("Photo must be under 512 KB.");
      return;
    }
    setPhotoUploading(true);
    setPhotoError(null);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await fetch("/api/agent/photo", { method: "POST", body: fd });
    const data = await res.json();
    setPhotoUploading(false);
    if (!res.ok) { setPhotoError(data.error ?? "Upload failed."); return; }
    setCurrentPhotoUrl(data.photoUrl);
    router.refresh();
  }

  async function handlePhotoDelete() {
    setPhotoUploading(true);
    await fetch("/api/agent/photo", { method: "DELETE" });
    setCurrentPhotoUrl(null);
    setPhotoUploading(false);
    router.refresh();
  }

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${user.agentSlug}`
      : `/verify/${user.agentSlug}`;

  return (
    <div className="space-y-6">
      <div className="border-b border-border/50">
        <nav className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setError(null); setSuccess(false); }}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2",
                  isActive
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {(error || success) && (
        <div className={cn(
          "p-3 rounded-xl text-sm border",
          error ? "bg-red-500/8 border-red-500/15 text-red-600" : "bg-emerald-500/8 border-emerald-500/15 text-emerald-600"
        )}>
          {error ?? "Settings saved successfully."}
        </div>
      )}

      {activeTab === "profile" && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="px-6 py-5 border-b border-border/40">
            <h2 className="text-base font-semibold text-foreground">Profile Information</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your personal and business details. This information appears on your verification page and secure requests.</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                <Input value={user.email} disabled className="h-10 rounded-xl bg-muted/50" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    required
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="agencyName" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Agency Name
                  </Label>
                  <Input
                    id="agencyName"
                    value={form.agencyName}
                    onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                    placeholder="Rivera Financial Group"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Company
                  </Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Rivera Holdings LLC"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  Industry
                </Label>
                <Input
                  id="industry"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="Life Insurance, Health Insurance, Medicare..."
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="licenseNumber" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    License / ID Number
                  </Label>
                  <Input
                    id="licenseNumber"
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
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
                    value={form.licensedStates}
                    onChange={(e) => setForm({ ...form, licensedStates: e.target.value })}
                    placeholder="CA, TX, FL"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading} className="h-10 px-6 rounded-xl font-medium">
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                  ) : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "branding" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="px-6 py-5 border-b border-border/40">
              <h2 className="text-base font-semibold text-foreground">Company Logo</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your logo appears at the top of secure client pages and email notifications.</p>
            </div>
            <div className="p-6">
              {logoError && (
                <div className="mb-4 p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-sm text-red-600">{logoError}</div>
              )}
              {currentLogoUrl ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentLogoUrl}
                    alt="Agency logo"
                    className="h-16 max-w-[200px] object-contain rounded-xl border border-border/40 bg-muted/30 p-3"
                  />
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="rounded-xl"
                    >
                      {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Replace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoDelete}
                      disabled={logoUploading}
                      className="rounded-xl text-red-500 hover:bg-red-500/10 hover:border-red-500/30 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 bg-muted/20"
                >
                  {logoUploading ? (
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">Click to upload logo</span>
                      <span className="text-[11px] text-muted-foreground/60">PNG, JPG, WebP, or SVG. Max 512 KB</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="px-6 py-5 border-b border-border/40">
              <h2 className="text-base font-semibold text-foreground">Profile Photo</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Displayed to clients on secure forms. Helps build trust and recognition.</p>
            </div>
            <div className="p-6">
              {photoError && (
                <div className="mb-4 p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-sm text-red-600">{photoError}</div>
              )}
              {currentPhotoUrl ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentPhotoUrl}
                    alt="Profile photo"
                    className="w-20 h-20 object-cover rounded-full border-2 border-border/40 ring-4 ring-primary/5"
                  />
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoUploading}
                      className="rounded-xl"
                    >
                      {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      Replace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePhotoDelete}
                      disabled={photoUploading}
                      className="rounded-xl text-red-500 hover:bg-red-500/10 hover:border-red-500/30 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 bg-muted/20"
                >
                  {photoUploading ? (
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">Click to upload photo</span>
                      <span className="text-[11px] text-muted-foreground/60">PNG, JPG, or WebP. Max 512 KB</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="px-6 py-5 border-b border-border/40">
              <h2 className="text-base font-semibold text-foreground">Preview</h2>
              <p className="text-xs text-muted-foreground mt-0.5">How your branding appears on secure client requests.</p>
            </div>
            <div className="p-6">
              <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-5">
                <div className="flex items-center gap-3 mb-3">
                  {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {currentLogoUrl && (
                        <img src={currentLogoUrl} alt="" className="h-5 w-auto object-contain" />
                      )}
                      <p className="text-sm font-semibold text-foreground">{form.displayName || "Your Name"}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">has requested your information securely</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-primary" />
                    End-to-end encrypted
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-500" />
                    Verified sender
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-primary" />
                    Secure Link
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "client" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="px-6 py-5 border-b border-border/40">
              <h2 className="text-base font-semibold text-foreground">Client-Facing Settings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Customize how your secure requests appear and behave for clients.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="destinationLabel" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Destination Label
                  </Label>
                  <Input
                    id="destinationLabel"
                    value={form.destinationLabel}
                    onChange={(e) => setForm({ ...form, destinationLabel: e.target.value })}
                    placeholder="e.g. Mutual of Omaha, Aetna, Internal processing"
                    className="h-10 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">Shown on the secure form so clients know where their info is going.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="carriersList" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    Carriers
                  </Label>
                  <Input
                    id="carriersList"
                    value={form.carriersList}
                    onChange={(e) => setForm({ ...form, carriersList: e.target.value })}
                    placeholder="Aetna, Humana, Cigna, UnitedHealth"
                    className="h-10 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">Comma-separated list shown on your verification page.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trustMessage" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Default Trust Message
                  </Label>
                  <textarea
                    id="trustMessage"
                    value={form.trustMessage}
                    onChange={(e) => setForm({ ...form, trustMessage: e.target.value })}
                    rows={3}
                    placeholder="e.g. Your information is encrypted end-to-end and will only be used for your policy application. Feel free to reach out if you have any questions."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">Appears on your secure request page to reassure clients.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notificationEmail" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Notification Email
                  </Label>
                  <Input
                    id="notificationEmail"
                    type="email"
                    value={form.notificationEmail}
                    onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })}
                    placeholder="alerts@youragency.com"
                    className="h-10 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">Receives an email when a client submits. Defaults to your account email if blank.</p>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={loading} className="h-10 px-6 rounded-xl font-medium">
                    {loading ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                    ) : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="px-6 py-5 border-b border-border/40">
              <h2 className="text-base font-semibold text-foreground">Verification Page</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Share this link with clients so they can verify your identity and learn how secure links work.</p>
            </div>
            <div className="p-6">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={verifyUrl}
                  className="h-10 rounded-xl font-mono text-sm bg-muted/30"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl shrink-0"
                  onClick={() => navigator.clipboard.writeText(verifyUrl)}
                >
                  Copy
                </Button>
                <Button asChild variant="outline" size="sm" className="h-10 rounded-xl shrink-0">
                  <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "trust" && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="px-6 py-5 border-b border-border/40">
            <h2 className="text-base font-semibold text-foreground">Trust & Security</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Control security indicators, data handling policies, and default link behavior.</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="verificationStatus" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verification Status
                </Label>
                <select
                  id="verificationStatus"
                  value={form.verificationStatus}
                  onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                >
                  <option value="UNVERIFIED">Unverified (no badge shown)</option>
                  <option value="LICENSED">Licensed Agent</option>
                  <option value="CERTIFIED">Certified Agent</option>
                  <option value="REGULATED">Regulated Professional</option>
                </select>
                <p className="text-[11px] text-muted-foreground">Displays a trust badge on client forms. Only declare a status that is accurate.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Data Retention Policy
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, dataRetentionDays: opt.value })}
                      className={cn(
                        "h-10 rounded-xl text-xs font-medium border transition-all",
                        form.dataRetentionDays === opt.value
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background text-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">How long submitted data is retained before automatic deletion.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5" />
                  Default Link Expiration
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, defaultExpirationHours: opt.value })}
                      className={cn(
                        "h-10 rounded-xl text-xs font-medium border transition-all",
                        form.defaultExpirationHours === opt.value
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background text-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Default expiration time for new secure links. Can be overridden per link.</p>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading} className="h-10 px-6 rounded-xl font-medium">
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                  ) : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
