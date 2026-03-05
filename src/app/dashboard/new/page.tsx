"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, CheckCheck, ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LINK_TYPES } from "@/lib/utils";

type LinkType = "BANKING_INFO" | "SSN_DOB" | "FULL_INTAKE" | "SSN_ONLY";

interface CreatedLink {
  token: string;
  url: string;
  smsText: string;
  expiresAt: string;
}

export default function NewLinkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);

  const [form, setForm] = useState({
    linkType: "BANKING_INFO" as LinkType,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    expirationHours: 24,
    viewOnce: true,
    retentionDays: 7,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setCreated(data);
  }

  function copyLink() {
    if (!created) return;
    navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copySms() {
    if (!created) return;
    navigator.clipboard.writeText(created.smsText);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2000);
  }

  if (created) {
    return (
      <div className="max-w-xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <CardTitle>Secure link created</CardTitle>
            <CardDescription>
              Send this link to your client. It expires{" "}
              {new Date(created.expiresAt).toLocaleString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Link URL */}
            <div className="space-y-2">
              <Label>Secure link</Label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={created.url}
                  className="flex-1 h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-none"
                />
                <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0">
                  {copied ? (
                    <CheckCheck className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Pre-written SMS */}
            <div className="space-y-2">
              <Label>Pre-written SMS message</Label>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {created.smsText}
                </p>
              </div>
              <Button onClick={copySms} variant="outline" size="sm" className="w-full">
                {copiedSms ? (
                  <CheckCheck className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedSms ? "Copied SMS text" : "Copy SMS text"}
              </Button>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                onClick={() => {
                  setCreated(null);
                  setForm({
                    linkType: "BANKING_INFO",
                    clientName: "",
                    clientPhone: "",
                    clientEmail: "",
                    expirationHours: 24,
                    viewOnce: true,
                    retentionDays: 7,
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                Create another
              </Button>
              <Button onClick={() => router.push("/dashboard")} className="flex-1">
                Go to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create secure link</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate a private link for your client to submit sensitive information.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Link type */}
            <div className="space-y-2">
              <Label>Information type</Label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.entries(LINK_TYPES) as [LinkType, string][]).map(
                  ([type, label]) => (
                    <label
                      key={type}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.linkType === type
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="linkType"
                        value={type}
                        checked={form.linkType === type}
                        onChange={() =>
                          setForm({
                            ...form,
                            linkType: type,
                            expirationHours: type === "SSN_ONLY" ? 168 : form.expirationHours,
                          })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-slate-800">
                        {label}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>

            {/* Client info */}
            <div className="space-y-1.5">
                <Label htmlFor="clientName">
                  Client name{" "}
                  <span className="text-muted-foreground font-normal">
                    {form.linkType === "SSN_ONLY"
                      ? "(required for SSN links)"
                      : "(optional — for your reference)"}
                  </span>
                </Label>
              <Input
                id="clientName"
                value={form.clientName}
                onChange={(e) =>
                  setForm({ ...form, clientName: e.target.value })
                }
                required={form.linkType === "SSN_ONLY"}
                placeholder="John Smith"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Client phone</Label>
                <Input
                  id="clientPhone"
                  type="tel"
                  value={form.clientPhone}
                  onChange={(e) =>
                    setForm({ ...form, clientPhone: e.target.value })
                  }
                  placeholder="555-000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientEmail">Client email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={form.clientEmail}
                  onChange={(e) =>
                    setForm({ ...form, clientEmail: e.target.value })
                  }
                  placeholder="client@email.com"
                />
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-1.5">
              <Label htmlFor="expirationHours">Expires after</Label>
              <select
                id="expirationHours"
                value={form.expirationHours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    expirationHours: parseInt(e.target.value),
                  })
                }
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours (default)</option>
                <option value={48}>48 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </div>

            {/* Security options */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.viewOnce}
                  onChange={(e) =>
                    setForm({ ...form, viewOnce: e.target.checked })
                  }
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    View-once mode
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    After you reveal the submission, sensitive fields will be masked permanently.
                  </div>
                </div>
              </label>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Creating..." : "Generate secure link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
