"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface Props {
  user: {
    displayName: string;
    agencyName: string | null;
    phone: string | null;
    licenseNumber: string | null;
    licensedStates: string | null;
    agentSlug: string;
    email: string;
  };
}

export function SettingsForm({ user }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: user.displayName,
    agencyName: user.agencyName ?? "",
    phone: user.phone ?? "",
    licenseNumber: user.licenseNumber ?? "",
    licensedStates: user.licensedStates ?? "",
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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
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
              className="flex-1 h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-600"
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
