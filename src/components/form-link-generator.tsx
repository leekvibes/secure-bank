"use client";

import { useState } from "react";
import { Copy, CheckCheck, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrandingSelector } from "@/components/branding-selector";

interface Props {
  formId: string;
  formTitle: string;
  agentName?: string;
}

interface GeneratedLink {
  url: string;
  smsText: string;
  expiresAt: string;
}

export function FormLinkGenerator({ formId, formTitle, agentName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    destination: "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    expirationHours: 24,
  });

  async function generate() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/forms/${formId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assetIds: selectedAssetIds }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to generate link.");
      return;
    }

    setGenerated(data);
  }

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Generate link</CardTitle>
            <CardDescription>Create a secure link to share this form with a client.</CardDescription>
          </div>
          {!open && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Link2 className="w-3.5 h-3.5" />
              Generate
            </Button>
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {generated ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Secure link</Label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={generated.url}
                    className="flex-1 h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(generated.url, setCopied)}
                    className="shrink-0"
                  >
                    {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  Expires {new Date(generated.expiresAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Pre-written SMS</Label>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{generated.smsText}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copy(generated.smsText, setCopiedSms)}
                >
                  {copiedSms ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copiedSms ? "Copied SMS" : "Copy SMS text"}
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setGenerated(null);
                  setSelectedAssetIds([]);
                  setForm({ destination: "", clientName: "", clientPhone: "", clientEmail: "", expirationHours: 24 });
                }}
              >
                Generate another
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gl-dest">Where will this be submitted?</Label>
                <select
                  id="gl-dest"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select destination</option>
                  <option>Mutual of Omaha</option>
                  <option>Americo</option>
                  <option>Aetna</option>
                  <option>Internal processing</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gl-name">Client name (optional)</Label>
                <Input
                  id="gl-name"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gl-phone">Client phone</Label>
                  <Input
                    id="gl-phone"
                    type="tel"
                    value={form.clientPhone}
                    onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                    placeholder="555-000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-email">Client email</Label>
                  <Input
                    id="gl-email"
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                    placeholder="client@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gl-exp">Expires after</Label>
                <select
                  id="gl-exp"
                  value={form.expirationHours}
                  onChange={(e) => setForm({ ...form, expirationHours: parseInt(e.target.value) })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={1}>1 hour</option>
                  <option value={4}>4 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Branding <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <BrandingSelector
                  selectedIds={selectedAssetIds}
                  onChange={setSelectedAssetIds}
                  agentName={agentName}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button size="sm" onClick={generate} disabled={loading} className="flex-1 gap-1.5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate link"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
