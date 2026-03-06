"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, Upload, X, Loader2 } from "lucide-react";

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
    industry: string | null;
    destinationLabel: string | null;
    carriersList: string | null;
    notificationEmail: string | null;
    verificationStatus: string;
    dataRetentionDays: number;
  };
}

export function SettingsForm({ user }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(user.logoUrl);

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

    if (!res.ok) {
      setLogoError(data.error ?? "Upload failed.");
      return;
    }

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

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${user.agentSlug}`
      : `/verify/${user.agentSlug}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            This information appears on your verification page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
              Settings saved.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agencyName">Agency name</Label>
              <Input
                id="agencyName"
                value={form.agencyName}
                onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                placeholder="Rivera Financial Group"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Rivera Holdings LLC"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="Life Insurance, Health Insurance, Medicare..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="555-000-0001"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="licenseNumber">License #</Label>
                <Input
                  id="licenseNumber"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  placeholder="LA-123456"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="licensedStates">Licensed states</Label>
                <Input
                  id="licensedStates"
                  value={form.licensedStates}
                  onChange={(e) => setForm({ ...form, licensedStates: e.target.value })}
                  placeholder="CA, TX, FL"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>
            Your logo appears at the top of secure client pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoError && (
            <p className="text-sm text-red-400">{logoError}</p>
          )}
          {currentLogoUrl ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentLogoUrl}
                alt="Agency logo"
                className="h-14 max-w-[180px] object-contain rounded-lg border border-border/40 bg-surface-2 p-2"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoDelete}
                disabled={logoUploading}
                className="text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
              >
                {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
              >
                {logoUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {logoUploading ? "Uploading..." : "Upload logo"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">PNG, JPG, WebP or SVG · Max 512 KB</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client experience</CardTitle>
          <CardDescription>
            Customize how your secure form pages appear to clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
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
              if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
              setSuccess(true);
              router.refresh();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="destinationLabel">Destination label</Label>
              <Input
                id="destinationLabel"
                value={form.destinationLabel}
                onChange={(e) => setForm({ ...form, destinationLabel: e.target.value })}
                placeholder="e.g. Aetna · Blue Shield · Nationwide"
              />
              <p className="text-xs text-muted-foreground">Shown on the secure form so clients know where their info is going.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carriersList">Carriers (display only)</Label>
              <Input
                id="carriersList"
                value={form.carriersList}
                onChange={(e) => setForm({ ...form, carriersList: e.target.value })}
                placeholder="Aetna, Humana, Cigna, UnitedHealth"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list for your reference or verification page.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notificationEmail">Notification email</Label>
              <Input
                id="notificationEmail"
                type="email"
                value={form.notificationEmail}
                onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })}
                placeholder="alerts@youragency.com"
              />
              <p className="text-xs text-muted-foreground">Receives an email when a client submits. Defaults to your account email.</p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trust & compliance</CardTitle>
          <CardDescription>
            These settings control security indicators shown on your client forms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
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
              if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
              setSuccess(true);
              router.refresh();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="verificationStatus">Verification status</Label>
              <select
                id="verificationStatus"
                value={form.verificationStatus}
                onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/50"
              >
                <option value="UNVERIFIED">Unverified (no badge shown)</option>
                <option value="LICENSED">Licensed Agent</option>
                <option value="CERTIFIED">Certified Agent</option>
                <option value="REGULATED">Regulated Professional</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Displays a badge on client forms. Only declare a status that is accurate.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataRetentionDays">Default data retention</Label>
              <select
                id="dataRetentionDays"
                value={form.dataRetentionDays}
                onChange={(e) => setForm({ ...form, dataRetentionDays: parseInt(e.target.value) })}
                className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/50"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={-1}>Manual deletion</option>
              </select>
              <p className="text-xs text-muted-foreground">
                How long submitted data is retained before automatic deletion.
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification page</CardTitle>
          <CardDescription>
            Share this link with skeptical clients to verify your identity and
            explain how secure links work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              readOnly
              value={verifyUrl}
              className="flex-1 h-11 px-3 text-sm bg-surface-2 border border-border/40 rounded-lg font-mono text-muted-foreground"
            />
            <Button asChild variant="outline" size="sm">
              <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
