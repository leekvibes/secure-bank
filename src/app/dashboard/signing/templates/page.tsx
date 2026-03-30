"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Trash2, LayoutTemplate, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TemplateSlot {
  id: string;
  slotIndex: number;
  role: string;
}

interface Template {
  id: string;
  title: string;
  originalName: string | null;
  fieldsJson: string;
  recipientSlots: TemplateSlot[];
  createdAt: string;
}

function fieldCount(fieldsJson: string): number {
  try { return (JSON.parse(fieldsJson) as unknown[]).length; } catch { return 0; }
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/signing/templates");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to load templates.");
      setTemplates((data as { templates: Template[] }).templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTemplates(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/signing/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template.");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link href="/dashboard/signing">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Document Templates</h1>
            <p className="text-sm text-muted-foreground">Reuse agreements — assign signers and send in seconds.</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && templates.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-20 text-center gap-3">
          <LayoutTemplate className="w-10 h-10 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">No templates yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Open any sent or completed agreement and click{" "}
            <strong>&quot;Save as Template&quot;</strong> to add it here.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/dashboard/signing">Go to Agreements</Link>
          </Button>
        </div>
      )}

      {!loading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col gap-0 overflow-hidden"
            >
              <div className="p-4 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate">{t.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-red-600 flex-shrink-0"
                    onClick={() => void handleDelete(t.id)}
                    disabled={deletingId === t.id}
                  >
                    {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {t.originalName && (
                  <p className="text-xs text-muted-foreground truncate">{t.originalName}</p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{t.recipientSlots.length} signer{t.recipientSlots.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{fieldCount(t.fieldsJson)} field{fieldCount(t.fieldsJson) !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {t.recipientSlots.slice(0, 3).map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-xs px-1.5 py-0">{s.role}</Badge>
                  ))}
                  {t.recipientSlots.length > 3 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">+{t.recipientSlots.length - 3} more</Badge>
                  )}
                </div>
              </div>
              <div className="border-t border-border px-4 py-3 bg-muted/30">
                <Button
                  className="w-full h-8 text-xs font-semibold"
                  onClick={() => setActiveTemplate(t)}
                >
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTemplate && (
        <UseTemplateModal
          template={activeTemplate}
          onClose={() => setActiveTemplate(null)}
          onSuccess={(requestId) => router.push(`/dashboard/signing/${requestId}`)}
        />
      )}
    </div>
  );
}

function UseTemplateModal({
  template,
  onClose,
  onSuccess,
}: {
  template: Template;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
}) {
  const [slots, setSlots] = useState<Array<{ slotIndex: number; role: string; name: string; email: string }>>(() =>
    template.recipientSlots.map((s) => ({ slotIndex: s.slotIndex, role: s.role, name: "", email: "" }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSlot(idx: number, field: "name" | "email", value: string) {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  async function handleCreate() {
    for (const s of slots) {
      if (!s.name.trim()) { setError(`Enter a name for "${s.role}".`); return; }
      if (!s.email.trim()) { setError(`Enter an email for "${s.role}".`); return; }
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/signing/templates/${template.id}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Failed to create agreement.");
      onSuccess((data as { requestId: string }).requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agreement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Use Template: {template.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Assign a signer to each role, then create the agreement.</p>
        </div>
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {slots.map((slot, i) => (
            <div key={slot.slotIndex} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{slot.role}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Full name"
                  value={slot.name}
                  onChange={(e) => updateSlot(i, "name", e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Email address"
                  type="email"
                  value={slot.email}
                  onChange={(e) => updateSlot(i, "email", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1 h-9" onClick={() => void handleCreate()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Agreement
          </Button>
        </div>
      </div>
    </div>
  );
}
