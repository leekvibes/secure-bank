"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, UploadCloud, FileText, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;
type SigningMode = "PARALLEL" | "SEQUENTIAL";

interface UploadedPage {
  page: number;
  widthPts: number;
  heightPts: number;
}

interface RecipientDraft {
  id: string;
  name: string;
  email: string;
}

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Recipients" },
  { id: 3, label: "Fields" },
  { id: 4, label: "Review & Send" },
];

function makeRecipient(): RecipientDraft {
  return { id: crypto.randomUUID(), name: "", email: "" };
}

export default function NewSigningRequestPage() {
  const [step, setStep] = useState<Step>(1);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(72);

  const [fileName, setFileName] = useState<string | null>(null);
  const [documentBlobUrl, setDocumentBlobUrl] = useState<string | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [pages, setPages] = useState<UploadedPage[]>([]);

  const [recipients, setRecipients] = useState<RecipientDraft[]>([makeRecipient()]);
  const [signingMode, setSigningMode] = useState<SigningMode>("PARALLEL");
  const [ccInput, setCcInput] = useState("");

  const progressWidth = useMemo(() => `${((step - 1) / (STEPS.length - 1)) * 100}%`, [step]);
  const ccEmails = useMemo(
    () =>
      ccInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [ccInput]
  );

  async function ensureRequest(): Promise<{ id: string; token?: string }> {
    if (requestId) return { id: requestId, token: requestToken ?? undefined };
    const res = await fetch("/api/signing/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || undefined,
        message: message.trim() || undefined,
        expiresInHours,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to create signing request.");
    if (typeof data?.id !== "string") throw new Error("Invalid create response.");
    setRequestId(data.id);
    if (typeof data?.token === "string") setRequestToken(data.token);
    return { id: data.id, token: typeof data?.token === "string" ? data.token : undefined };
  }

  async function uploadPdf(file: File) {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File must be 25MB or smaller.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await ensureRequest();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(created.id)}/document`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to upload document.");

      const pageList = Array.isArray(data?.pages) ? data.pages : [];
      setFileName(file.name);
      setPages(pageList);
      setDocumentBlobUrl(typeof data?.blobUrl === "string" ? data.blobUrl : null);
      setDocumentHash(typeof data?.documentHash === "string" ? data.documentHash : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadPdf(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void uploadPdf(file);
  }

  function updateRecipient(id: string, patch: Partial<RecipientDraft>) {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function canContinueFromStep1() {
    return Boolean(requestId && pages.length > 0);
  }

  function canContinueFromStep2() {
    return recipients.some((recipient) => recipient.name.trim() && recipient.email.trim());
  }

  function goNext() {
    if (step === 1 && !canContinueFromStep1()) return;
    if (step === 2 && !canContinueFromStep2()) return;
    setStep((prev) => (prev < 4 ? ((prev + 1) as Step) : prev));
  }

  function goBack() {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link href="/dashboard/signing">
              <ArrowLeft className="w-4 h-4" />
              Back to Signing
            </Link>
          </Button>
          <h1 className="ui-page-title mt-2">New Signing Request</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your document, add recipients, then place fields and send.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300" style={{ width: progressWidth }} />
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {STEPS.map((item) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id <= step) setStep(item.id);
                }}
                className={cn(
                  "text-left rounded-lg border px-3 py-2 transition-colors",
                  active ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                  done && "border-emerald-500/30 bg-emerald-500/5"
                )}
              >
                <p className="text-[11px] text-muted-foreground">Step {item.id}</p>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  {done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                  {item.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Request title (optional)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Client Service Agreement"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="expiresIn">Expires in</Label>
                <select
                  id="expiresIn"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Drag and drop your PDF</p>
              <p className="text-xs text-muted-foreground mt-1">PDF only, max 25MB</p>
              <div className="mt-4">
                <label className="inline-flex">
                  <input type="file" accept="application/pdf" className="hidden" onChange={onFileInputChange} />
                  <span className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                    Choose PDF
                  </span>
                </label>
              </div>
            </div>

            {busy && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing document...
              </div>
            )}

            {fileName && pages.length > 0 && (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pages.length} page{pages.length === 1 ? "" : "s"} detected
                </p>
                {documentBlobUrl && (
                  <a href={documentBlobUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-2 inline-block">
                    Open uploaded PDF
                  </a>
                )}
                {documentHash && (
                  <p className="text-[11px] text-muted-foreground mt-2 break-all">
                    Hash: {documentHash}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recipients</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setRecipients((prev) => [...prev, makeRecipient()])}>
                <Plus className="w-3.5 h-3.5" />
                Add Recipient
              </Button>
            </div>
            <div className="space-y-3">
              {recipients.map((recipient, index) => (
                <div key={recipient.id} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Recipient {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecipient(recipient.id)}
                      disabled={recipients.length === 1}
                      className="text-muted-foreground"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={recipient.name}
                        onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                        placeholder="Full name"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={recipient.email}
                        onChange={(e) => updateRecipient(recipient.id, { email: e.target.value })}
                        placeholder="name@email.com"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <Label>Signing mode</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setSigningMode("PARALLEL")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm text-left",
                    signingMode === "PARALLEL" ? "border-primary/40 bg-primary/5" : "border-border"
                  )}
                >
                  Parallel
                </button>
                <button
                  type="button"
                  onClick={() => setSigningMode("SEQUENTIAL")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm text-left",
                    signingMode === "SEQUENTIAL" ? "border-primary/40 bg-primary/5" : "border-border"
                  )}
                >
                  Sequential
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>CC emails (comma-separated)</Label>
                <Input
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="manager@company.com, ops@company.com"
                  className="mt-1.5"
                />
                {ccEmails.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{ccEmails.length} CC email(s)</p>
                )}
              </div>
              <div>
                <Label>Expiration</Label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="message">Message (optional)</Label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Add context for your recipients..."
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">Field placement editor comes in Section 3</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload and recipients are ready. Waiting for confirmed fields API wiring.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">Review & send comes in Section 4</p>
          <p className="text-xs text-muted-foreground mt-1">
            Recipient payload is prepared and will be submitted once send API is finalized.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
          Back
        </Button>
        <Button
          type="button"
          onClick={goNext}
          disabled={
            busy ||
            (step === 1 && !canContinueFromStep1()) ||
            (step === 2 && !canContinueFromStep2())
          }
        >
          {step === 4 ? "Done" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

