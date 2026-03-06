"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Copy, CheckCheck, Shield, Loader2, CreditCard,
  Camera, ClipboardList, Clock, Send, Star, ChevronDown,
  Lock, Building2, Users, Plus, X, Trash2, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandingSelector } from "@/components/branding-selector";
import { buildTrustMessage } from "@/lib/link-message";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

type LinkType = "BANKING_INFO" | "SSN_ONLY" | "FULL_INTAKE" | "ID_UPLOAD";

interface ApiTemplate {
  id: string;
  name: string;
  linkType: string;
  destinationLabel: string | null;
  expiresIn: number;
  messageTemplate: string | null;
  options: Record<string, unknown>;
  assetIds: string[];
}

interface CreatedLink {
  id: string;
  token: string;
  url: string;
  smsText: string;
  trustMessage: string;
  expiresAt: string;
}

// ── Static config ──────────────────────────────────────────────────────────────

const DESTINATIONS = [
  "Mutual of Omaha",
  "Americo",
  "Aetna",
  "Internal processing",
];

const MESSAGE_MAX_CHARS = 4000;
const MESSAGE_WARN_CHARS = 3600;

const TYPE_META: Record<
  LinkType,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    borderActive: string;
    title: string;
    subtitle: string;
    defaultExpiry: number;
    previewFields: string[];
    infoColor: string;
    infoText: string;
  }
> = {
  BANKING_INFO: {
    icon: CreditCard,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    borderActive: "border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/40",
    title: "Banking Information",
    subtitle: "Routing, account number, draft date",
    defaultExpiry: 24,
    previewFields: ["Full name", "Routing number", "Bank name", "Account number (+ confirm)", "Draft date"],
    infoColor: "bg-blue-50 border-blue-100 text-blue-700",
    infoText: "Account number confirmation is always required for fraud prevention.",
  },
  SSN_ONLY: {
    icon: Shield,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    borderActive: "border-purple-500 ring-1 ring-purple-500/20 bg-purple-50/40",
    title: "Social Security Number",
    subtitle: "SSN with masked entry and confirmation",
    defaultExpiry: 168,
    previewFields: ["First name", "Last name", "SSN (masked + confirm)"],
    infoColor: "bg-purple-50 border-purple-100 text-purple-700",
    infoText: "SSN links default to 7-day expiration for compliance.",
  },
  FULL_INTAKE: {
    icon: ClipboardList,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    borderActive: "border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/40",
    title: "Full Intake Form",
    subtitle: "SSN, banking, address, and beneficiary",
    defaultExpiry: 48,
    previewFields: ["Full name", "Date of birth", "SSN", "Address", "Phone + email", "Beneficiary", "Banking info"],
    infoColor: "bg-emerald-50 border-emerald-100 text-emerald-700",
    infoText: "Most comprehensive intake — use for new policy applications.",
  },
  ID_UPLOAD: {
    icon: Camera,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    borderActive: "border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/40",
    title: "Photo ID Upload",
    subtitle: "Government-issued ID photo submission",
    defaultExpiry: 24,
    previewFields: ["Front of ID (required)", "Back of ID (optional)"],
    infoColor: "bg-amber-50 border-amber-100 text-amber-700",
    infoText: "Accepted: JPG, PNG, WebP, HEIC — max 10 MB per file.",
  },
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NewLinkPage() {
  const router = useRouter();

  // Core form state
  const [linkType, setLinkType] = useState<LinkType>("BANKING_INFO");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [destination, setDestination] = useState("Internal processing");
  const [customDest, setCustomDest] = useState("");
  const [expirationHours, setExpirationHours] = useState(24);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  // Type-specific options
  const [idBothSides, setIdBothSides] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [showSaveName, setShowSaveName] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Submission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLink | null>(null);

  // Post-generate send
  const [copied, setCopied] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [sendMethod, setSendMethod] = useState<"SMS" | "EMAIL" | "COPY">("SMS");
  const [sendPhone, setSendPhone] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const effectiveDest = destination === "Custom" ? customDest : destination;

  // Auto-generate message when type / destination / client name changes
  const regenerateMessage = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/secure/…`;
    setMessage(buildTrustMessage({ clientName, destination: effectiveDest, linkType, url }));
  }, [clientName, effectiveDest, linkType]);

  useEffect(() => { regenerateMessage(); }, [regenerateMessage]);

  // Load saved templates
  useEffect(() => {
    fetch("/api/link-templates")
      .then((r) => r.json())
      .then((d) => { if (d.templates) setTemplates(d.templates); })
      .catch(() => {});
  }, []);

  function applyTemplate(t: ApiTemplate) {
    const type = t.linkType as LinkType;
    setLinkType(type);
    if (t.destinationLabel) setDestination(t.destinationLabel);
    setExpirationHours(t.expiresIn);
    if (t.assetIds?.length) setSelectedAssetIds(t.assetIds);
    if (t.options?.requireBack) setIdBothSides(true);
    setActiveTemplateId(t.id);
  }

  async function saveAsTemplate() {
    if (!newTemplateName.trim()) return;
    setSavingTemplate(true);
    const options: Record<string, unknown> = {};
    if (linkType === "ID_UPLOAD") options.requireBack = idBothSides;

    const res = await fetch("/api/link-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTemplateName.trim(),
        linkType,
        destinationLabel: effectiveDest,
        expiresIn: expirationHours,
        messageTemplate: message,
        assetIds: selectedAssetIds,
        options: Object.keys(options).length ? options : undefined,
      }),
    });
    setSavingTemplate(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save template.");
      return;
    }
    const data = await res.json();
    // Refetch
    const r2 = await fetch("/api/link-templates");
    const d2 = await r2.json();
    if (d2.templates) setTemplates(d2.templates);
    setActiveTemplateId(data.id ?? "");
    setShowSaveName(false);
    setNewTemplateName("");
    toast({
      title: "Template saved",
      description: "Saved template is now available in your list.",
    });
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/link-templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete template.");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (activeTemplateId === id) setActiveTemplateId("");
    setDeleteConfirmId(null);
    toast({
      title: "Template deleted",
      description: "Template removed successfully.",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const options: Record<string, unknown> = {};
    if (linkType === "ID_UPLOAD") options.requireBack = idBothSides;

    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkType,
        destinationLabel: effectiveDest,
        message,
        options: Object.keys(options).length ? options : undefined,
        clientName: clientName || undefined,
        clientPhone: clientPhone || undefined,
        clientEmail: clientEmail || undefined,
        expirationHours,
        retentionDays: 7,
        assetIds: selectedAssetIds,
        ...(activeTemplateId ? { templateId: activeTemplateId } : {}),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setCreated(data);
    setSendMsg(data.trustMessage ?? data.smsText ?? message);
    setSendPhone(clientPhone);
    setSendEmail(clientEmail);
  }

  function copyLink() {
    if (!created) return;
    navigator.clipboard
      .writeText(created.url)
      .then(() => {
        setCopied(true);
        toast({
          title: "Link copied",
          description: "Secure link copied to clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast({
          title: "Clipboard failed",
          description: "Unable to copy link in this browser.",
          variant: "destructive",
        });
      });
  }

  function copySmsText() {
    if (!created) return;
    navigator.clipboard
      .writeText(created.smsText)
      .then(() => {
        setCopiedSms(true);
        toast({
          title: "Link copied",
          description: "Message copied to clipboard.",
        });
        setTimeout(() => setCopiedSms(false), 2000);
      })
      .catch(() => {
        toast({
          title: "Clipboard failed",
          description: "Unable to copy message in this browser.",
          variant: "destructive",
        });
      });
  }

  async function sendNow() {
    if (!created) return;
    setSending(true);
    setSendError(null);

    if (sendMethod === "COPY") {
      try {
        await navigator.clipboard.writeText(sendMsg);
      } catch {
        setSending(false);
        setSendError("Unable to copy message in this browser.");
        toast({
          title: "Clipboard failed",
          description: "Unable to copy message in this browser.",
          variant: "destructive",
        });
        return;
      }
      setSendSuccess(true);
      setSending(false);
      toast({
        title: "Link copied",
        description: "Message copied to clipboard.",
      });
      return;
    }

    const recipient = sendMethod === "SMS" ? sendPhone.trim() : sendEmail.trim();
    const res = await fetch(`/api/links/${created.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: sendMethod, recipient, message: sendMsg }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setSendError(data.error?.message ?? data.error ?? "Failed to send.");
      return;
    }
    setSendSuccess(true);
    toast({
      title: sendMethod === "SMS" ? "SMS sent" : "Email sent",
      description: "Link sent successfully.",
    });
  }

  function createAnother() {
    setCreated(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSendSuccess(false);
    setSendError(null);
    setCopied(false);
    setCopiedSms(false);
  }

  // ── Post-generate view ───────────────────────────────────────────────────────

  if (created) {
    return (
      <div className="max-w-lg">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6 text-slate-500">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </Button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Success header */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center ring-1 ring-emerald-100 shrink-0">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Link created</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Expires {new Date(created.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* URL row */}
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Secure URL</Label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={created.url}
                  className="flex-1 h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-none"
                />
                <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0 gap-1.5">
                  {copied ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Send panel */}
            <div className="space-y-3">
              <Label className="text-xs text-slate-500 block">Send to client</Label>
              {/* Method tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                {(["SMS", "EMAIL", "COPY"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSendMethod(m)}
                    className={cn(
                      "py-1.5 text-xs font-medium rounded-md transition-colors",
                      sendMethod === m
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {m === "SMS" ? "SMS" : m === "EMAIL" ? "Email" : "Copy text"}
                  </button>
                ))}
              </div>

              {sendMethod === "SMS" && (
                <Input
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  placeholder="+1 555-000-0000"
                  type="tel"
                />
              )}
              {sendMethod === "EMAIL" && (
                <Input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="client@email.com"
                />
              )}

              <textarea
                value={sendMsg}
                onChange={(e) => setSendMsg(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />

              <div className="flex gap-2">
                <Button
                  onClick={sendNow}
                  disabled={
                    sending ||
                    sendSuccess ||
                    !sendMsg.trim() ||
                    (sendMethod === "SMS" && !sendPhone.trim()) ||
                    (sendMethod === "EMAIL" && !sendEmail.trim())
                  }
                  className="flex-1 gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : sendSuccess ? (
                    <CheckCheck className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sendSuccess ? "Sent!" : "Send now"}
                </Button>
                <Button variant="outline" onClick={copySmsText} className="gap-1.5 shrink-0">
                  {copiedSms ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  Copy
                </Button>
              </div>

              {sendError && <p className="text-xs text-red-600">{sendError}</p>}
            </div>

            {/* Footer actions */}
            <div className="flex gap-2 pt-1 border-t border-slate-100">
              <Button onClick={createAnother} variant="outline" className="flex-1">
                Create another
              </Button>
              <Button onClick={() => router.push("/dashboard")} className="flex-1">
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Builder ────────────────────────────────────────────────────────────────

  const meta = TYPE_META[linkType];
  const previewFields =
    linkType === "ID_UPLOAD" && idBothSides
      ? ["Front of ID (required)", "Back of ID (required)"]
      : meta.previewFields;

  const expiryLabel =
    expirationHours >= 168
      ? "7 days"
      : expirationHours >= 72
      ? "3 days"
      : expirationHours >= 48
      ? "2 days"
      : expirationHours >= 24
      ? "1 day"
      : `${expirationHours}h`;

  return (
    <div className="max-w-[1100px]">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Create secure link
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate an encrypted, one-time link for your client.
          </p>
        </div>

        {/* Template picker */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <select
              value={activeTemplateId}
              onChange={(e) => {
                const t = templates.find((t) => t.id === e.target.value);
                if (t) applyTemplate(t);
              }}
              className={cn(
                "h-9 pl-3 pr-8 text-sm border rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-ring",
                activeTemplateId
                  ? "border-blue-300 text-blue-700"
                  : "border-slate-200 text-slate-600"
              )}
            >
              <option value="">
                {templates.length === 0 ? "No templates yet" : "Apply template…"}
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Save as template */}
          {showSaveName ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name"
                className="h-9 w-40 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveAsTemplate();
                  if (e.key === "Escape") setShowSaveName(false);
                }}
                autoFocus
              />
              <Button
                size="sm"
                onClick={saveAsTemplate}
                disabled={savingTemplate || !newTemplateName.trim()}
                className="h-9 px-3"
              >
                {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSaveName(false)}
                className="h-9 px-2"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSaveName(true)}
              className="h-9 gap-1.5"
            >
              <Star className="w-3.5 h-3.5" />
              Save
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* ── Left column ── */}
          <div className="space-y-5">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 1. Type cards */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Link type
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.entries(TYPE_META) as [LinkType, typeof meta][]).map(
                  ([type, c]) => {
                    const Icon = c.icon;
                    const active = linkType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setLinkType(type);
                          setExpirationHours(c.defaultExpiry);
                        }}
                        className={cn(
                          "flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                          active
                            ? c.borderActive
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            c.iconBg
                          )}
                        >
                          <Icon className={cn("w-4 h-4", c.iconColor)} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800 leading-tight">
                            {c.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {c.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* 2. Type-specific options panel */}
            <div
              className={cn(
                "rounded-xl border p-4 text-sm transition-all",
                meta.infoColor
              )}
            >
              <div className="flex items-start gap-2.5">
                <meta.icon className={cn("w-4 h-4 shrink-0 mt-0.5", meta.iconColor)} />
                <div className="flex-1">
                  <p className="font-medium text-[13px] mb-0.5">{meta.title}</p>
                  <p className="text-xs opacity-80">{meta.infoText}</p>
                  {linkType === "ID_UPLOAD" && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-current/20">
                      <span className="text-xs font-medium">Require both sides</span>
                      <button
                        type="button"
                        onClick={() => setIdBothSides((v) => !v)}
                        className={cn(
                          "relative inline-flex h-6 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none",
                          idBothSides ? "bg-amber-500" : "bg-amber-200/60"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                            idBothSides ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Client information */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Client information
              </p>
              <div>
                <Label htmlFor="clientName" className="text-slate-700 text-sm">
                  Client name
                  {linkType === "SSN_ONLY" ? (
                    <span className="text-red-500 ml-1 text-xs">required</span>
                  ) : (
                    <span className="text-slate-400 font-normal text-xs ml-1">(optional)</span>
                  )}
                </Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required={linkType === "SSN_ONLY"}
                  placeholder="John Smith"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="clientPhone" className="text-slate-700 text-sm">
                    Phone
                  </Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="555-000-0000"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="clientEmail" className="text-slate-700 text-sm">
                    Email
                  </Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            {/* 4. Destination */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Submission destination
              </p>
              <div>
                <Label className="text-slate-700 text-sm">
                  Where will this be submitted?
                </Label>
                <div className="relative mt-1.5">
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="flex h-11 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                    <option value="Custom">Custom…</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {destination === "Custom" && (
                  <Input
                    value={customDest}
                    onChange={(e) => setCustomDest(e.target.value)}
                    placeholder="Enter destination name"
                    className="mt-2"
                    required
                  />
                )}
              </div>
            </div>

            {/* 5. Message editor */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Client message
                </p>
                <button
                  type="button"
                  onClick={regenerateMessage}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
                rows={5}
                maxLength={MESSAGE_MAX_CHARS}
                placeholder="Auto-generated message will appear here…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                Edit freely. This message is sent alongside the link.
                </p>
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    message.length >= MESSAGE_WARN_CHARS ? "text-amber-600" : "text-slate-400"
                  )}
                >
                  {message.length}/{MESSAGE_MAX_CHARS}
                </p>
              </div>
            </div>

            {/* 6. Link settings */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Link settings
              </p>
              <div>
                <Label className="text-slate-700 text-sm">Expires after</Label>
                <div className="relative mt-1.5">
                  <select
                    value={expirationHours}
                    onChange={(e) => setExpirationHours(parseInt(e.target.value))}
                    className="flex h-11 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value={1}>1 hour</option>
                    <option value={4}>4 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>7 days</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <Label className="text-slate-700 text-sm">
                  Branding{" "}
                  <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </Label>
                <div className="mt-1.5">
                  <BrandingSelector
                    selectedIds={selectedAssetIds}
                    onChange={setSelectedAssetIds}
                  />
                </div>
              </div>
            </div>

            {/* 7. Saved templates management */}
            {templates.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Saved templates
                </p>
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                        activeTemplateId === t.id
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                      >
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {t.name}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {TYPE_META[t.linkType as LinkType]?.title ?? t.linkType}
                        </span>
                      </button>
                      {deleteConfirmId === t.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => deleteTemplate(t.id)}
                            className="text-xs text-red-600 font-medium"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-slate-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(t.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {loading ? "Creating…" : "Generate secure link"}
            </Button>
          </div>

          {/* ── Right column: live preview ── */}
          <div className="lg:sticky lg:top-6">
            <LivePreview
              linkType={linkType}
              clientName={clientName}
              destination={effectiveDest}
              expirationHours={expirationHours}
              message={message}
              previewFields={previewFields}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Live preview panel ─────────────────────────────────────────────────────────

function LivePreview({
  linkType,
  clientName,
  destination,
  expirationHours,
  message,
  previewFields,
}: {
  linkType: LinkType;
  clientName: string;
  destination: string;
  expirationHours: number;
  message: string;
  previewFields: string[];
}) {
  const meta = TYPE_META[linkType];
  const Icon = meta.icon;

  const expiryLabel =
    expirationHours >= 168
      ? "7 days"
      : expirationHours >= 72
      ? "3 days"
      : expirationHours >= 48
      ? "2 days"
      : expirationHours >= 24
      ? "24 hours"
      : `${expirationHours}h`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
      {/* Browser chrome */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2.5">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className="flex-1 bg-slate-100 rounded-md px-2.5 py-1 flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
          <span className="text-[11px] text-slate-400 font-mono">
            agentsecurelinks.com/secure/…
          </span>
        </div>
      </div>

      {/* Simulated client form */}
      <div className="p-3.5 space-y-3">
        {/* Simulated trust header */}
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Lock className="w-2.5 h-2.5" />
            Secure
          </div>
          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-white" />
          </div>
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[7px] font-bold">
              A
            </div>
            <span className="text-[10px] text-slate-600">Agent</span>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", meta.iconBg)}>
              <Icon className={cn("w-3 h-3", meta.iconColor)} />
            </div>
            <span className="text-[11px] font-medium text-slate-600">{meta.title}</span>
          </div>

          {/* Greeting — updates live as client name is typed */}
          {clientName && (
            <p className="text-[12px] font-semibold text-slate-800">
              Hi {clientName.split(" ")[0]},
            </p>
          )}

          {/* Message preview */}
          {message && (
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-line">
                {message}
              </p>
            </div>
          )}

          {/* Field stubs */}
          <div className="space-y-2">
            {previewFields.map((f) => (
              <div key={f} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 rounded bg-slate-200" style={{ width: `${Math.min(60, 30 + f.length * 2)}%` }} />
                </div>
                <div className="h-8 bg-slate-50 border border-slate-200 rounded-lg" />
              </div>
            ))}
          </div>

          {/* Consent stub */}
          <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg">
            <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white mt-0.5 shrink-0" />
            <div className="space-y-1 flex-1">
              <div className="h-1.5 bg-slate-200 rounded w-full" />
              <div className="h-1.5 bg-slate-200 rounded w-4/5" />
            </div>
          </div>

          {/* Submit button stub */}
          <div className="h-9 bg-slate-900 rounded-lg flex items-center justify-center">
            <span className="text-[11px] text-white font-medium">Submit securely</span>
          </div>
        </div>

        {/* Meta strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 px-0.5">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expires in {expiryLabel}
          </span>
          {destination && (
            <>
              <span className="text-slate-200">·</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {destination}
              </span>
            </>
          )}
          {clientName && (
            <>
              <span className="text-slate-200">·</span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {clientName}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
