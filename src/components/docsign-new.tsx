"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, PenLine, Hash, Calendar, User,
  Loader2, ChevronRight, ChevronLeft, Send, ArrowLeft, X, Plus, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldType = "SIGNATURE" | "INITIALS" | "DATE" | "NAME";
type Assignee = "AGENT" | "CLIENT";

interface SignField {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo: Assignee;
  value?: string;
}

interface DragState {
  fieldId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

const FIELD_META: Record<FieldType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  SIGNATURE: { label: "Signature",  icon: PenLine,   color: "text-blue-600",   bg: "bg-blue-50 border-blue-300" },
  INITIALS:  { label: "Initials",   icon: Hash,      color: "text-violet-600", bg: "bg-violet-50 border-violet-300" },
  DATE:      { label: "Date",       icon: Calendar,  color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-300" },
  NAME:      { label: "Full Name",  icon: User,      color: "text-amber-600",  bg: "bg-amber-50 border-amber-300" },
};

const FIELD_DEFAULTS: Record<FieldType, { w: number; h: number }> = {
  SIGNATURE: { w: 0.25, h: 0.05 },
  INITIALS:  { w: 0.10, h: 0.04 },
  DATE:      { w: 0.18, h: 0.04 },
  NAME:      { w: 0.22, h: 0.04 },
};

let fieldCounter = 0;
function newId() { return `f_${++fieldCounter}_${Date.now()}`; }

export function DocSignNew() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "fields" | "details">("upload");

  // Step 1 — file
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — field placement
  const [docId, setDocId] = useState<string | null>(null);
  const [docToken, setDocToken] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<SignField[]>([]);
  const [activeField, setActiveField] = useState<FieldType>("SIGNATURE");
  const [activeAssignee, setActiveAssignee] = useState<Assignee>("CLIENT");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [agentValues, setAgentValues] = useState<Record<string, string>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  // Step 3 — details + send
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload() {
    if (!file) return;
    setUploading(true);
    setFileError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/docsign", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setFileError(data?.error?.message ?? "Upload failed."); return; }
      setDocId(data.data.id);
      setDocToken(data.data.token);
      setDocUrl(`/api/docsign/${data.data.id}`);
      setStep("fields");
    } catch { setFileError("Network error. Try again."); }
    finally { setUploading(false); }
  }

  // Place field on click
  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (drag) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const def = FIELD_DEFAULTS[activeField];
    const newField: SignField = {
      id: newId(),
      type: activeField,
      page: 0,
      x: Math.min(rx, 1 - def.w),
      y: Math.min(ry, 1 - def.h),
      width: def.w,
      height: def.h,
      assignedTo: activeAssignee,
    };
    setFields((f) => [...f, newField]);
  }

  function startDrag(e: React.MouseEvent, fieldId: string) {
    e.stopPropagation();
    const field = fields.find((f) => f.id === fieldId)!;
    setDrag({ fieldId, startX: e.clientX, startY: e.clientY, origX: field.x, origY: field.y });
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    setFields((prev) => prev.map((f) => {
      if (f.id !== drag.fieldId) return f;
      return { ...f, x: Math.max(0, Math.min(drag.origX + dx, 1 - f.width)), y: Math.max(0, Math.min(drag.origY + dy, 1 - f.height)) };
    }));
  }, [drag]);

  const onMouseUp = useCallback(() => setDrag(null), []);

  useEffect(() => {
    if (drag) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [drag, onMouseMove, onMouseUp]);

  async function saveFieldsAndProceed() {
    if (!docId) return;
    const agentFields = fields.filter((f) => f.assignedTo === "AGENT").map((f) => ({ ...f, value: agentValues[f.id] ?? "" }));
    await fetch(`/api/docsign/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldsJson: JSON.stringify(fields), agentSignJson: JSON.stringify(agentFields) }),
    });
    setStep("details");
  }

  async function handleSend() {
    if (!docId) return;
    setSending(true);
    setError(null);
    try {
      // Save details
      await fetch(`/api/docsign/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null, message: message.trim() || null, clientName: clientName.trim() || null, clientEmail: clientEmail.trim() || null }),
      });
      // Send
      const res = await fetch(`/api/docsign/${docId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data?.error?.message ?? "Failed to send."); return; }
      setSent(true);
    } catch { setError("Network error. Try again."); }
    finally { setSending(false); }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Signing request sent</h1>
        <p className="text-muted-foreground mb-8">
          {clientEmail ? `An email was sent to ${clientEmail}.` : "Your client can now sign the document."}
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => router.push(`/dashboard/docsign/${docId}`)}>View request</Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/docsign")}>Back to documents</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => step === "upload" ? router.push("/dashboard/docsign") : setStep(step === "details" ? "fields" : "upload")}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">New signing request</h1>
          <div className="flex items-center gap-2 mt-1">
            {(["upload","fields","details"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold", step === s ? "bg-primary text-primary-foreground" : ["upload","fields","details"].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                  {["upload","fields","details"].indexOf(step) > i ? "✓" : i + 1}
                </div>
                <span className={cn("text-xs", step === s ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {s === "upload" ? "Upload" : s === "fields" ? "Place fields" : "Details & send"}
                </span>
                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="max-w-lg mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Upload your document</h2>
            <p className="text-sm text-muted-foreground">PDF, JPG, or PNG — max 20 MB. You will place signature fields in the next step.</p>
          </div>

          {!file ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Click to upload document</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, JPG, PNG up to 20 MB</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (!f) return;
              if (f.size > 20 * 1024 * 1024) { setFileError("File must be under 20 MB."); return; }
              setFileError(null);
              setFile(f);
            }}
          />

          {fileError && <p className="text-sm text-red-500">{fileError}</p>}

          <Button onClick={handleFileUpload} disabled={!file || uploading} className="w-full h-11 font-semibold gap-2">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
          </Button>
        </div>
      )}

      {/* Step 2: Field placement */}
      {step === "fields" && docId && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar */}
            <div className="lg:w-72 shrink-0 space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Add field</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(FIELD_META) as FieldType[]).map((type) => {
                    const { label, icon: Icon, color, bg } = FIELD_META[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setActiveField(type)}
                        className={cn("flex items-center gap-2 p-3 rounded-xl border text-left transition-all", activeField === type ? `${bg} border-2` : "border-border bg-card hover:bg-secondary")}
                      >
                        <Icon className={cn("w-4 h-4 shrink-0", activeField === type ? color : "text-muted-foreground")} />
                        <span className={cn("text-xs font-medium", activeField === type ? color : "text-foreground")}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Assign to</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["CLIENT", "AGENT"] as Assignee[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setActiveAssignee(a)}
                      className={cn("p-2.5 rounded-xl border text-xs font-medium transition-all", activeAssignee === a ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-secondary text-foreground")}
                    >
                      {a === "CLIENT" ? "Client" : "Me (agent)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent fields that need values */}
              {fields.filter((f) => f.assignedTo === "AGENT").length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Your signatures</p>
                  <div className="space-y-2">
                    {fields.filter((f) => f.assignedTo === "AGENT").map((f) => {
                      const { label, color } = FIELD_META[f.type];
                      return (
                        <div key={f.id} className="space-y-1">
                          <Label className={cn("text-xs", color)}>{label}</Label>
                          <Input
                            value={agentValues[f.id] ?? ""}
                            onChange={(e) => setAgentValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                            placeholder={f.type === "DATE" ? new Date().toLocaleDateString() : f.type === "NAME" ? "Your name" : "Your signature"}
                            className="h-8 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {fields.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Fields ({fields.length})</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {fields.map((f) => {
                      const { label, icon: Icon, color } = FIELD_META[f.type];
                      return (
                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm">
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
                          <span className="text-foreground flex-1">{label}</span>
                          <span className="text-xs text-muted-foreground">{f.assignedTo === "CLIENT" ? "Client" : "You"}</span>
                          <button onClick={() => setFields((prev) => prev.filter((x) => x.id !== f.id))} className="text-muted-foreground hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <Button onClick={saveFieldsAndProceed} className="w-full gap-2" disabled={fields.length === 0}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Click on the document to place fields</p>
                )}
              </div>
            </div>

            {/* Document canvas */}
            <div className="flex-1 min-h-0">
              <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Click anywhere on the document to place a <strong className={FIELD_META[activeField].color}>{FIELD_META[activeField].label}</strong> field for <strong>{activeAssignee === "CLIENT" ? "client" : "you"}</strong>
              </div>
              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="relative w-full bg-gray-100 rounded-xl overflow-hidden border border-border cursor-crosshair"
                style={{ minHeight: "600px" }}
              >
                {/* PDF/image preview via iframe */}
                <iframe
                  src={`/api/docsign/${docId}`}
                  className="w-full h-full absolute inset-0 pointer-events-none"
                  style={{ minHeight: "600px", height: "100%" }}
                  title="Document preview"
                />

                {/* Field overlays */}
                {fields.map((f) => {
                  const { label, icon: Icon, color, bg } = FIELD_META[f.type];
                  return (
                    <div
                      key={f.id}
                      onMouseDown={(e) => startDrag(e, f.id)}
                      className={cn("absolute flex items-center gap-1 px-2 rounded border cursor-move select-none text-xs font-medium", bg, color)}
                      style={{
                        left: `${f.x * 100}%`,
                        top: `${f.y * 100}%`,
                        width: `${f.width * 100}%`,
                        height: `${f.height * 100}%`,
                      }}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{label} ({f.assignedTo === "CLIENT" ? "Client" : "You"})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Details & send */}
      {step === "details" && (
        <div className="max-w-lg mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Request details</h2>
            <p className="text-sm text-muted-foreground">Add a title and your client's info before sending.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-sm font-medium mb-1.5 block">Document title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Policy Application — John Smith" />
            </div>
            <div>
              <Label htmlFor="clientName" className="text-sm font-medium mb-1.5 block">Client name</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <Label htmlFor="clientEmail" className="text-sm font-medium mb-1.5 block">
                Client email <span className="text-red-500">*</span>
              </Label>
              <Input id="clientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.com" />
            </div>
            <div>
              <Label htmlFor="message" className="text-sm font-medium mb-1.5 block">Message to client <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Please review and sign the attached document at your earliest convenience."
                className="w-full rounded-xl border border-border px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Summary</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• {fields.filter((f) => f.assignedTo === "CLIENT").length} field(s) for client to complete</p>
              <p>• {fields.filter((f) => f.assignedTo === "AGENT").length} field(s) pre-signed by you</p>
              {!clientEmail.trim() && <p className="text-amber-600">• Client email required to send via email</p>}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleSend}
              disabled={sending || !clientEmail.trim()}
              className="w-full h-11 font-semibold gap-2"
            >
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send signing request</>}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // Save as draft and go to detail page
                if (!docId) return;
                await fetch(`/api/docsign/${docId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: title.trim() || null, message: message.trim() || null, clientName: clientName.trim() || null, clientEmail: clientEmail.trim() || null }),
                });
                router.push(`/dashboard/docsign/${docId}`);
              }}
              className="w-full"
            >
              Save as draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
