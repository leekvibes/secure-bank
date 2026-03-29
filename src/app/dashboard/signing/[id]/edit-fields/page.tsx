"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FieldType =
  | "SIGNATURE"
  | "INITIALS"
  | "DATE_SIGNED"
  | "FULL_NAME"
  | "TITLE"
  | "COMPANY"
  | "TEXT"
  | "CHECKBOX"
  | "RADIO"
  | "DROPDOWN"
  | "ATTACHMENT";

interface RecipientServer {
  id: string;
  name: string;
  email: string;
  order: number;
}

interface PageData {
  page: number;
  widthPts: number;
  heightPts: number;
}

interface PlacedField {
  id: string;
  type: FieldType;
  recipientId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  options?: string[];
}

interface DragState {
  mode: "move" | "resize";
  fieldId: string;
  pageRect: DOMRect;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

const FIELD_TYPES: Array<{ type: FieldType; label: string }> = [
  { type: "SIGNATURE", label: "Signature" },
  { type: "INITIALS", label: "Initials" },
  { type: "DATE_SIGNED", label: "Date Signed" },
  { type: "FULL_NAME", label: "Full Name" },
  { type: "TITLE", label: "Title" },
  { type: "COMPANY", label: "Company" },
  { type: "TEXT", label: "Text" },
  { type: "CHECKBOX", label: "Checkbox" },
  { type: "RADIO", label: "Radio" },
  { type: "DROPDOWN", label: "Dropdown" },
  { type: "ATTACHMENT", label: "Attachment" },
];

const RECIPIENT_STYLES = [
  { border: "border-blue-500", bg: "bg-blue-500/10", text: "text-blue-700", chip: "border-blue-300 bg-blue-100 text-blue-800" },
  { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700", chip: "border-emerald-300 bg-emerald-100 text-emerald-800" },
  { border: "border-violet-500", bg: "bg-violet-500/10", text: "text-violet-700", chip: "border-violet-300 bg-violet-100 text-violet-800" },
  { border: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-700", chip: "border-orange-300 bg-orange-100 text-orange-800" },
  { border: "border-pink-500", bg: "bg-pink-500/10", text: "text-pink-700", chip: "border-pink-300 bg-pink-100 text-pink-800" },
];

function clamp(v: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

function defaultFieldSize(type: FieldType) {
  if (type === "SIGNATURE") return { width: 0.22, height: 0.06 };
  if (type === "INITIALS") return { width: 0.12, height: 0.05 };
  if (type === "CHECKBOX") return { width: 0.04, height: 0.04 };
  if (type === "ATTACHMENT") return { width: 0.24, height: 0.055 };
  return { width: 0.18, height: 0.045 };
}

export default function EditFieldsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [recipients, setRecipients] = useState<RecipientServer[]>([]);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [activeFieldType, setActiveFieldType] = useState<FieldType>("SIGNATURE");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);

  const recipientColorIndexById = useMemo(() => {
    const map = new Map<string, number>();
    recipients.forEach((r, idx) => map.set(r.id, idx % RECIPIENT_STYLES.length));
    return map;
  }, [recipients]);

  useEffect(() => {
    if (!activeRecipientId && recipients.length > 0) {
      setActiveRecipientId(recipients[0].id);
    }
  }, [recipients, activeRecipientId]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to load request.");
        const req = (data?.request ?? data) as Record<string, unknown>;

        if (!req.isEditable) {
          router.replace(`/dashboard/signing/${id}`);
          return;
        }

        const pagesRaw = Array.isArray(req.pages) ? req.pages : [];
        const recipientsRaw = Array.isArray(req.recipients) ? req.recipients : [];
        const fieldsRaw = Array.isArray(req.signingFields) ? req.signingFields : [];

        const loadedPages: PageData[] = (pagesRaw as Record<string, unknown>[])
          .map((p) => ({ page: Number(p.page), widthPts: Number(p.widthPts), heightPts: Number(p.heightPts) }))
          .filter((p) => p.page > 0 && p.widthPts > 0 && p.heightPts > 0);

        const loadedRecipients: RecipientServer[] = (recipientsRaw as Record<string, unknown>[])
          .map((r) => ({ id: String(r.id ?? ""), name: String(r.name ?? ""), email: String(r.email ?? ""), order: Number(r.order ?? 0) }))
          .filter((r) => r.id);

        const loadedFields: PlacedField[] = (fieldsRaw as Record<string, unknown>[])
          .map((f) => {
            let options: string[] | undefined;
            if (Array.isArray(f.options)) options = (f.options as unknown[]).map(String);
            else if (typeof f.options === "string" && f.options.trim().startsWith("[")) {
              try { const p = JSON.parse(f.options) as unknown; if (Array.isArray(p)) options = (p as unknown[]).map(String); } catch {}
            }
            return {
              id: String(f.id ?? crypto.randomUUID()),
              type: String(f.type ?? "TEXT") as FieldType,
              recipientId: String(f.recipientId ?? ""),
              page: Number(f.page ?? 1),
              x: clamp(Number(f.x ?? 0)),
              y: clamp(Number(f.y ?? 0)),
              width: clamp(Number(f.width ?? 0.18), 0.02, 1),
              height: clamp(Number(f.height ?? 0.045), 0.02, 1),
              required: Boolean(f.required ?? true),
              ...(options && options.length > 0 ? { options } : {}),
            };
          })
          .filter((f) => f.recipientId);

        if (!cancelled) {
          setTitle(typeof req.title === "string" ? req.title : (typeof req.originalName === "string" ? req.originalName : null));
          setBlobUrl(typeof req.blobUrl === "string" ? req.blobUrl : null);
          setPages(loadedPages);
          setRecipients(loadedRecipients);
          setPlacedFields(loadedFields);
          if (loadedPages.length > 0) setActivePage(loadedPages[0].page);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load request.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedFieldId) return;
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      e.preventDefault();
      setPlacedFields((prev) => prev.filter((f) => f.id !== selectedFieldId));
      setSelectedFieldId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFieldId]);

  const updateField = useCallback((fieldId: string, patch: Partial<PlacedField>) => {
    setPlacedFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
  }, []);

  const onMove = useCallback((e: MouseEvent) => {
    const state = dragStateRef.current;
    if (!state) return;
    const dx = (e.clientX - state.startClientX) / state.pageRect.width;
    const dy = (e.clientY - state.startClientY) / state.pageRect.height;
    if (state.mode === "move") {
      updateField(state.fieldId, {
        x: clamp(state.startX + dx, 0, 1 - state.startWidth),
        y: clamp(state.startY + dy, 0, 1 - state.startHeight),
      });
    } else {
      updateField(state.fieldId, {
        width: clamp(state.startWidth + dx, 0.02, 1 - state.startX),
        height: clamp(state.startHeight + dy, 0.02, 1 - state.startY),
      });
    }
  }, [updateField]);

  const stopDrag = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", onMove as EventListener);
    window.removeEventListener("mouseup", stopDrag);
  }, [onMove]);

  useEffect(() => () => stopDrag(), [stopDrag]);

  function placeFieldOnPage(page: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!activeRecipientId) return;
    const node = pageRefs.current[page];
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const size = defaultFieldSize(activeFieldType);
    const field: PlacedField = {
      id: crypto.randomUUID(),
      type: activeFieldType,
      recipientId: activeRecipientId,
      page,
      x: clamp(cx - size.width / 2, 0, 1 - size.width),
      y: clamp(cy - size.height / 2, 0, 1 - size.height),
      width: size.width,
      height: size.height,
      required: true,
      ...(activeFieldType === "RADIO" || activeFieldType === "DROPDOWN" ? { options: ["Option A", "Option B"] } : {}),
    };
    setPlacedFields((prev) => [...prev, field]);
    setSelectedFieldId(field.id);
  }

  function beginDrag(e: React.MouseEvent, field: PlacedField, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    const node = pageRefs.current[field.page];
    if (!node) return;
    dragStateRef.current = {
      mode, fieldId: field.id, pageRect: node.getBoundingClientRect(),
      startClientX: e.clientX, startClientY: e.clientY,
      startX: field.x, startY: field.y, startWidth: field.width, startHeight: field.height,
    };
    setSelectedFieldId(field.id);
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", stopDrag);
  }

  async function handleSave() {
    if (!id || placedFields.length === 0) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(id)}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: placedFields.map((f) => ({
            type: f.type,
            recipientId: f.recipientId,
            page: f.page,
            x: Number(f.x.toFixed(6)),
            y: Number(f.y.toFixed(6)),
            width: Number(f.width.toFixed(6)),
            height: Number(f.height.toFixed(6)),
            required: f.required,
            ...(f.options && f.options.length > 0 ? { options: f.options } : {}),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to save fields.");
      setSaved(true);
      setTimeout(() => router.push(`/dashboard/signing/${id}`), 600);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save fields.");
    } finally {
      setSaveBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href={`/dashboard/signing/${id}`}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link href={`/dashboard/signing/${id}`}>
              <ArrowLeft className="w-4 h-4" />
              Back to Request
            </Link>
          </Button>
          <h1 className="ui-page-title mt-2">Edit Field Placements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {title || "Untitled request"} · Move, resize, add, or delete fields
          </p>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Fields saved — redirecting…
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
        <aside className="rounded-xl border border-border bg-card p-4 space-y-4 lg:sticky lg:top-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recipient</p>
            <div className="space-y-2">
              {recipients.map((r) => {
                const idx = recipientColorIndexById.get(r.id) ?? 0;
                const colors = RECIPIENT_STYLES[idx];
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRecipientId(r.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      activeRecipientId === r.id ? `${colors.chip} border` : "border-border hover:bg-muted"
                    )}
                  >
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-[11px] opacity-80 truncate">{r.email}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Field Types</p>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setActiveFieldType(item.type)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs text-left",
                    activeFieldType === item.type ? "border-primary/40 bg-primary/5 text-primary" : "border-border hover:bg-muted"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {selectedFieldId && (() => {
            const sel = placedFields.find((f) => f.id === selectedFieldId);
            if (!sel) return null;
            return (
              <div className="pt-2 border-t border-border space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selected Field</p>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Field Type</label>
                  <select
                    value={sel.type}
                    onChange={(e) => updateField(sel.id, { type: e.target.value as FieldType })}
                    className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Assigned To</label>
                  <select
                    value={sel.recipientId}
                    onChange={(e) => updateField(sel.id, { recipientId: e.target.value })}
                    className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                  >
                    {recipients.map((r, i) => (
                      <option key={r.id} value={r.id}>
                        {r.name || r.email} (Signer {i + 1})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Required</label>
                  <button
                    type="button"
                    onClick={() => updateField(sel.id, { required: !sel.required })}
                    className={`w-9 h-5 rounded-full transition-colors ${sel.required ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5 ${sel.required ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setPlacedFields((prev) => prev.filter((f) => f.id !== selectedFieldId));
                    setSelectedFieldId(null);
                  }}
                >
                  Remove Field
                </Button>
              </div>
            );
          })()}

          <div className="space-y-2 pt-2 border-t border-border">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleSave}
              disabled={saveBusy || saved || placedFields.length === 0}
            >
              {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Click on a page to place a field. Drag to move, corner handle to resize. Delete/Backspace removes selected.
            </p>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Field Placement · {placedFields.length} field{placedFields.length === 1 ? "" : "s"}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={activePage <= 1} onClick={() => setActivePage((p) => Math.max(1, p - 1))}>
                Prev Page
              </Button>
              <span className="text-xs text-muted-foreground">Page {activePage} / {pages.length || 1}</span>
              <Button variant="outline" size="sm" disabled={activePage >= pages.length} onClick={() => setActivePage((p) => Math.min(pages.length, p + 1))}>
                Next Page
              </Button>
            </div>
          </div>

          {pages.map((pageData) => (
            <div
              key={pageData.page}
              className={cn(
                "rounded-xl border overflow-hidden bg-card",
                activePage === pageData.page ? "border-primary/40 shadow-sm" : "border-border"
              )}
            >
              <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">Page {pageData.page}</div>
              <div
                ref={(node) => { pageRefs.current[pageData.page] = node; }}
                className="relative w-full select-none"
                style={{ aspectRatio: `${pageData.widthPts} / ${pageData.heightPts}` }}
                onClick={(e) => { setActivePage(pageData.page); placeFieldOnPage(pageData.page, e); }}
              >
                {blobUrl ? (
                  <iframe
                    src={`${blobUrl}#page=${pageData.page}&toolbar=0&navpanes=0&scrollbar=0`}
                    className="absolute inset-0 w-full h-full border-none bg-white"
                    style={{ pointerEvents: "none" }}
                    title={`Page ${pageData.page}`}
                  />
                ) : (
                  <div className="absolute inset-0 bg-white" />
                )}

                <div className="absolute inset-0">
                  {placedFields
                    .filter((f) => f.page === pageData.page)
                    .map((field) => {
                      const recipient = recipients.find((r) => r.id === field.recipientId);
                      const colorIdx = recipientColorIndexById.get(field.recipientId) ?? 0;
                      const colors = RECIPIENT_STYLES[colorIdx];
                      return (
                        <div
                          key={field.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                          onMouseDown={(e) => beginDrag(e, field, "move")}
                          className={cn(
                            "absolute rounded-md border-2 cursor-move flex items-center justify-between px-2 text-[10px] font-medium overflow-hidden",
                            colors.border, colors.bg, colors.text,
                            selectedFieldId === field.id ? "ring-2 ring-primary/40" : ""
                          )}
                          style={{
                            left: `${field.x * 100}%`, top: `${field.y * 100}%`,
                            width: `${field.width * 100}%`, height: `${field.height * 100}%`,
                            minWidth: "50px", minHeight: "22px",
                          }}
                        >
                          <span className="truncate">{FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type}</span>
                          <span className="truncate opacity-80 ml-1">{recipient?.name ?? "Recipient"}</span>
                          <button
                            type="button"
                            onMouseDown={(e) => beginDrag(e, field, "resize")}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-foreground/40 cursor-se-resize"
                            aria-label="Resize field"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
