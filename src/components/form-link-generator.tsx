"use client";

import { useState } from "react";
import { Copy, CheckCheck, Link2, Loader2, Shield, Lock, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrandingSelector } from "@/components/branding-selector";
import { cn } from "@/lib/utils";

interface Props {
  formId: string;
  formTitle: string;
  agentName?: string;
}

interface GeneratedLink {
  url: string;
  messageText: string;
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
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500">{error}</div>
          )}

          {generated ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/5 via-primary/5 to-transparent p-4 border border-border/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center ring-1 ring-emerald-500/20 shrink-0">
                    <Shield className="w-4.5 h-4.5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Secure link ready</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" />
                        Encrypted
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-2.5 h-2.5" />
                        Expires {new Date(generated.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 flex items-center h-10 px-3 bg-surface-2 border border-border/40 rounded-xl overflow-hidden">
                    <span className="text-xs font-mono text-foreground/80 truncate select-all">{generated.url}</span>
                  </div>
                  <Button
                    variant={copied ? "default" : "outline"}
                    size="sm"
                    onClick={() => copy(generated.url, setCopied)}
                    className={cn("shrink-0 gap-1.5 h-10 px-3 rounded-xl transition-all duration-300", copied && "bg-emerald-500 hover:bg-emerald-600 border-emerald-500")}
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="w-3 h-3 text-primary" />
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Client Message</p>
                </div>
                <div className="bg-surface-2 rounded-xl p-4 border border-border/30">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{generated.messageText}</p>
                </div>
                <Button
                  variant={copiedSms ? "default" : "outline"}
                  size="sm"
                  className={cn("w-full gap-1.5 h-10 rounded-xl transition-all duration-300", copiedSms && "bg-emerald-500 hover:bg-emerald-600 border-emerald-500")}
                  onClick={() => copy(generated.messageText, setCopiedSms)}
                >
                  {copiedSms ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSms ? "Copied" : "Copy Message"}
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 rounded-xl"
                onClick={() => {
                  setGenerated(null);
                  setSelectedAssetIds([]);
                  setForm({ destination: "", clientName: "", clientPhone: "", clientEmail: "", expirationHours: 24 });
                }}
              >
                Generate Another Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gl-dest">
                  Where is this information going?{" "}
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="gl-dest"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="e.g. Mutual of Omaha, your company name, a mortgage lender..."
                />
                <p className="text-xs text-muted-foreground">
                  Your client sees this so they know who receives their information
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gl-name">
                  Client name{" "}
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="gl-name"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="e.g. John Smith"
                />
                <p className="text-xs text-muted-foreground">
                  Helps you identify whose submission this is
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gl-phone">
                    Phone{" "}
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="gl-phone"
                    type="tel"
                    value={form.clientPhone}
                    onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                    placeholder="e.g. (555) 123-4567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-email">
                    Email{" "}
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="gl-email"
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                    placeholder="e.g. client@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gl-exp">Expires after</Label>
                <select
                  id="gl-exp"
                  value={form.expirationHours}
                  onChange={(e) => setForm({ ...form, expirationHours: parseInt(e.target.value) })}
                  className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/50"
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
