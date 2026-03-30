"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  Globe,
  Loader2,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;
type SigningMode = "PARALLEL" | "SEQUENTIAL";
type AuthLevel = "LINK_ONLY" | "EMAIL_OTP" | "SMS_OTP";

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

interface UploadedPage {
  page: number;
  widthPts: number;
  heightPts: number;
}

interface RecipientDraft {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface RecipientServer {
  id: string;
  name: string;
  email: string;
  order: number;
}

interface DetailPage {
  page: number;
  widthPts: number;
  heightPts: number;
  imageUrl: string | null;
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

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Recipients" },
  { id: 3, label: "Fields" },
  { id: 4, label: "Review & Send" },
];

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
  {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-700",
    chip: "border-blue-300 bg-blue-100 text-blue-800",
  },
  {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700",
    chip: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  {
    border: "border-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-700",
    chip: "border-violet-300 bg-violet-100 text-violet-800",
  },
  {
    border: "border-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-700",
    chip: "border-orange-300 bg-orange-100 text-orange-800",
  },
  {
    border: "border-pink-500",
    bg: "bg-pink-500/10",
    text: "text-pink-700",
    chip: "border-pink-300 bg-pink-100 text-pink-800",
  },
];

function makeRecipient(): RecipientDraft {
  return { id: crypto.randomUUID(), name: "", email: "", phone: "" };
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function defaultFieldSize(type: FieldType) {
  if (type === "SIGNATURE") return { width: 0.22, height: 0.06 };
  if (type === "INITIALS") return { width: 0.12, height: 0.05 };
  if (type === "CHECKBOX") return { width: 0.04, height: 0.04 };
  if (type === "ATTACHMENT") return { width: 0.24, height: 0.055 };
  return { width: 0.18, height: 0.045 };
}

function normalizeDetail(data: unknown): {
  pages: DetailPage[];
  recipients: RecipientServer[];
  fields: PlacedField[];
  blobUrl: string | null;
  title: string;
  message: string;
  originalName: string | null;
  documentHash: string | null;
} {
  const source = (data as { request?: unknown })?.request ?? data;
  const request = source as {
    blobUrl?: unknown;
    title?: unknown;
    message?: unknown;
    originalName?: unknown;
    documentHash?: unknown;
    pages?: unknown;
    recipients?: unknown;
    signingFields?: unknown;
  };
  const pagesRaw = Array.isArray(request?.pages) ? request.pages : [];
  const recipientsRaw = Array.isArray(request?.recipients) ? request.recipients : [];
  const fieldsRaw = Array.isArray(request?.signingFields) ? request.signingFields : [];

  const pages: DetailPage[] = pagesRaw
    .map((page) => {
      const p = page as Record<string, unknown>;
      const imageUrl =
        (typeof p.imageUrl === "string" && p.imageUrl) ||
        (typeof p.pageImageUrl === "string" && p.pageImageUrl) ||
        (typeof p.pngUrl === "string" && p.pngUrl) ||
        (typeof p.blobUrl === "string" && p.blobUrl) ||
        null;
      return {
        page: Number(p.page ?? 0),
        widthPts: Number(p.widthPts ?? 0),
        heightPts: Number(p.heightPts ?? 0),
        imageUrl,
      };
    })
    .filter((page) => page.page > 0 && page.widthPts > 0 && page.heightPts > 0);

  const recipients: RecipientServer[] = recipientsRaw
    .map((recipient) => {
      const r = recipient as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        order: Number(r.order ?? 0),
      };
    })
    .filter((recipient) => recipient.id && recipient.name && recipient.email);

  const fields: PlacedField[] = fieldsRaw
    .map((field) => {
      const f = field as Record<string, unknown>;
      let options: string[] | undefined;
      if (Array.isArray(f.options)) {
        options = f.options.map((option) => String(option));
      } else if (typeof f.options === "string" && f.options.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(f.options) as unknown;
          if (Array.isArray(parsed)) options = parsed.map((option) => String(option));
        } catch {}
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
    .filter((field) => field.recipientId);

  return {
    pages,
    recipients,
    fields,
    blobUrl: typeof request?.blobUrl === "string" ? request.blobUrl : null,
    title: typeof request?.title === "string" ? request.title : "",
    message: typeof request?.message === "string" ? request.message : "",
    originalName: typeof request?.originalName === "string" ? request.originalName : null,
    documentHash: typeof request?.documentHash === "string" ? request.documentHash : null,
  };
}

export default function NewSigningRequestPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [templateInstanceId, setTemplateInstanceId] = useState<string | null>(null);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(72);

  const [fileName, setFileName] = useState<string | null>(null);
  const [documentBlobUrl, setDocumentBlobUrl] = useState<string | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"uploading" | "converting" | null>(null);
  const [pages, setPages] = useState<UploadedPage[]>([]);
  const [detailPages, setDetailPages] = useState<DetailPage[]>([]);

  const [recipients, setRecipients] = useState<RecipientDraft[]>([makeRecipient()]);
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [createdPublicLinkUrl, setCreatedPublicLinkUrl] = useState<string | null>(null);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [savedRecipients, setSavedRecipients] = useState<RecipientServer[]>([]);
  const [signingMode, setSigningMode] = useState<SigningMode>("PARALLEL");
  const [authLevel, setAuthLevel] = useState<AuthLevel>("LINK_ONLY");
  const [ccInput, setCcInput] = useState("");

  const [activeFieldType, setActiveFieldType] = useState<FieldType>("SIGNATURE");
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [placementViewMode, setPlacementViewMode] = useState<"CLICK" | "SCROLL">("CLICK");

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const placementScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const progressWidth = useMemo(() => `${((step - 1) / (STEPS.length - 1)) * 100}%`, [step]);
  const isDocumentTemplateMode = searchParams.get("mode") === "document-template";
  const ccEmails = useMemo(
    () =>
      ccInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [ccInput]
  );
  const step3Pages = useMemo(
    () =>
      pages.map((page) => ({
        page: page.page,
        widthPts: page.widthPts,
        heightPts: page.heightPts,
        imageUrl: null as string | null,
      })),
    [pages]
  );
  const displayPages = detailPages.length > 0 ? detailPages : step3Pages;
  const activePageIndex = useMemo(
    () => displayPages.findIndex((page) => page.page === activePage),
    [displayPages, activePage]
  );
  const activePageData = activePageIndex >= 0 ? displayPages[activePageIndex] : displayPages[0] ?? null;
  const recipientListForReview = savedRecipients.length > 0
    ? savedRecipients
    : recipients
        .map((recipient, index) => ({
          id: recipient.id || `draft-${index}`,
          name: recipient.name.trim(),
          email: recipient.email.trim(),
          order: index,
        }))
        .filter((recipient) => recipient.name && recipient.email);
  const fieldCountByRecipient = useMemo(() => {
    const map = new Map<string, number>();
    placedFields.forEach((field) => {
      map.set(field.recipientId, (map.get(field.recipientId) ?? 0) + 1);
    });
    return map;
  }, [placedFields]);
  const recipientsMissingFields = useMemo(
    () => recipientListForReview.filter((recipient) => (fieldCountByRecipient.get(recipient.id) ?? 0) === 0),
    [recipientListForReview, fieldCountByRecipient]
  );
  const expiresAtPreview = useMemo(
    () => new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toLocaleString(),
    [expiresInHours]
  );

  const recipientColorIndexById = useMemo(() => {
    const map = new Map<string, number>();
    savedRecipients.forEach((recipient, idx) => {
      map.set(recipient.id, idx % RECIPIENT_STYLES.length);
    });
    return map;
  }, [savedRecipients]);

  useEffect(() => {
    if (!isPublicMode) return;
    // Public links should always use direct-link auth and parallel semantics.
    setAuthLevel("LINK_ONLY");
    setSigningMode("PARALLEL");
  }, [isPublicMode]);

  useEffect(() => {
    const initialRequestId = searchParams.get("requestId");
    if (!initialRequestId || requestId) return;
    const requestIdParam = initialRequestId;

    const initialTemplateInstanceId = searchParams.get("templateInstanceId");
    if (initialTemplateInstanceId) setTemplateInstanceId(initialTemplateInstanceId);

    let cancelled = false;
    async function hydrateExistingRequest() {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestIdParam)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error?.message ?? data?.error ?? "Failed to load existing signing request.");
        }

        const normalized = normalizeDetail(data);
        if (cancelled) return;

        setRequestId(requestIdParam);
        if (normalized.title) setTitle(normalized.title);
        if (normalized.message) setMessage(normalized.message);
        if (normalized.originalName) setFileName(normalized.originalName);
        if (normalized.documentHash) setDocumentHash(normalized.documentHash);
        if (normalized.blobUrl) setDocumentBlobUrl(normalized.blobUrl);

        if (normalized.pages.length > 0) {
          setPages(
            normalized.pages.map((page) => ({
              page: page.page,
              widthPts: page.widthPts,
              heightPts: page.heightPts,
            })),
          );
          setDetailPages(normalized.pages);
          setActivePage(normalized.pages[0].page);
        }
        if (normalized.recipients.length > 0) {
          setSavedRecipients(normalized.recipients);
          setRecipients(
            normalized.recipients.map((recipient) => ({
              id: recipient.id,
              name: recipient.name,
              email: recipient.email,
              phone: "",
            })),
          );
          setActiveRecipientId(normalized.recipients[0].id);
        }
        if (normalized.fields.length > 0) setPlacedFields(normalized.fields);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load existing request.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void hydrateExistingRequest();
    return () => {
      cancelled = true;
    };
  }, [requestId, searchParams]);

  useEffect(() => {
    if (!activeRecipientId && savedRecipients.length > 0) {
      setActiveRecipientId(savedRecipients[0].id);
    }
  }, [savedRecipients, activeRecipientId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!selectedFieldId) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable) return;
      event.preventDefault();
      setPlacedFields((prev) => prev.filter((field) => field.id !== selectedFieldId));
      setSelectedFieldId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFieldId]);

  useEffect(() => {
    if (step !== 3) return;
    if (placementViewMode !== "CLICK") return;
    const container = placementScrollRef.current;
    const node = pageRefs.current[activePage];
    if (!container || !node) return;
    const top = Math.max(0, node.offsetTop - 12);
    container.scrollTo({ top, behavior: "smooth" });
  }, [activePage, step, placementViewMode]);

  useEffect(() => {
    if (step !== 3) return;
    if (placementViewMode !== "SCROLL") return;
    const container = placementScrollRef.current;
    if (!container) return;

    const ratios: Record<number, number> = {};
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const rawPage = (entry.target as HTMLElement).dataset.pageNum;
          const page = Number(rawPage ?? 0);
          if (!page) continue;
          ratios[page] = entry.isIntersecting ? entry.intersectionRatio : 0;
        }
        const top = Object.entries(ratios)
          .map(([page, ratio]) => ({ page: Number(page), ratio }))
          .filter((row) => row.ratio > 0.35)
          .sort((a, b) => b.ratio - a.ratio)[0];
        if (top?.page) setActivePage(top.page);
      },
      { root: container, threshold: [0.35, 0.5, 0.7, 0.9] }
    );

    for (const [page, node] of Object.entries(pageRefs.current)) {
      if (!node) continue;
      node.dataset.pageNum = page;
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [step, placementViewMode, displayPages]);

  useEffect(() => {
    if (displayPages.length === 0) return;
    if (displayPages.some((page) => page.page === activePage)) return;
    setActivePage(displayPages[0].page);
  }, [displayPages, activePage]);

  // Render PDF pages as images when entering step 3 (replaces unreliable iframes)
  useEffect(() => {
    if (step !== 3) return;
    if (!documentBlobUrl) return;
    if (detailPages.length > 0 && detailPages.every((p) => p.imageUrl)) return; // already rendered
    let cancelled = false;
    async function renderPages() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ url: documentBlobUrl! }).promise;
        const rendered: DetailPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          const dim = pages.find((p) => p.page === i);
          rendered.push({
            page: i,
            widthPts: dim?.widthPts ?? vp.width / 2,
            heightPts: dim?.heightPts ?? vp.height / 2,
            imageUrl: canvas.toDataURL("image/jpeg", 0.92),
          });
        }
        if (!cancelled) setDetailPages(rendered);
      } catch (err) {
        console.warn("[step3/render] pdfjs failed, staying with iframe fallback:", err);
      }
    }
    void renderPages();
    return () => { cancelled = true; };
  }, [step, documentBlobUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback((fieldId: string, patch: Partial<PlacedField>) => {
    setPlacedFields((prev) => prev.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  }, []);

  const onMove = useCallback((event: MouseEvent) => {
    const state = dragStateRef.current;
    if (!state) return;
    const dxPx = event.clientX - state.startClientX;
    const dyPx = event.clientY - state.startClientY;
    const dx = dxPx / state.pageRect.width;
    const dy = dyPx / state.pageRect.height;

    if (state.mode === "move") {
      updateField(state.fieldId, {
        x: clamp(state.startX + dx, 0, 1 - state.startWidth),
        y: clamp(state.startY + dy, 0, 1 - state.startHeight),
      });
      return;
    }

    const nextWidth = clamp(state.startWidth + dx, 0.02, 1 - state.startX);
    const nextHeight = clamp(state.startHeight + dy, 0.02, 1 - state.startY);
    updateField(state.fieldId, { width: nextWidth, height: nextHeight });
  }, [updateField]);

  const stopDrag = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", onMove as EventListener);
    window.removeEventListener("mouseup", stopDrag);
  }, [onMove]);

  useEffect(() => {
    return () => stopDrag();
  }, [stopDrag]);

  async function ensureRequest(): Promise<{ id: string; token?: string }> {
    if (requestId) return { id: requestId, token: requestToken ?? undefined };
    const res = await fetch("/api/signing/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || undefined,
        message: message.trim() || undefined,
        expiresInHours,
        authLevel,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? "Failed to create signing request.");
    if (typeof data?.id !== "string") throw new Error("Invalid create response.");
    setRequestId(data.id);
    if (typeof data?.token === "string") setRequestToken(data.token);
    return { id: data.id, token: typeof data?.token === "string" ? data.token : undefined };
  }

  const ACCEPTED_UPLOAD_TYPES = new Set([
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/gif", "image/tiff", "image/bmp", "image/heic",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  async function uploadPdf(file: File) {
    if (!ACCEPTED_UPLOAD_TYPES.has(file.type)) {
      setError("Unsupported file type. Please upload a PDF, image (JPG, PNG, WebP, GIF), or Word document (.doc, .docx).");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File must be 50MB or smaller.");
      return;
    }

    const isPdf = file.type === "application/pdf";
    setBusy(true);
    setUploadStatus(isPdf ? "uploading" : "converting");
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
      setDetailPages([]);
      setDocumentBlobUrl(typeof data?.blobUrl === "string" ? data.blobUrl : null);
      setDocumentHash(typeof data?.documentHash === "string" ? data.documentHash : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadStatus(null);
    }
  }

  async function saveRecipientsAndLoadDetail() {
    if (!requestId) throw new Error("Please upload a document first.");
    const cleaned = isPublicMode
      ? [{ name: "Public Signer", email: "public@placeholder.internal", phone: null, order: 0 }]
      : recipients
          .map((recipient, idx) => ({
            name: recipient.name.trim(),
            email: recipient.email.trim(),
            phone: recipient.phone.trim() || null,
            order: idx,
          }))
          .filter((recipient) => recipient.name && recipient.email);
    if (cleaned.length === 0) throw new Error("Add at least one recipient.");

    const saveRes = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: cleaned,
        signingMode,
        authLevel,
        ccEmails,
        message: message.trim() || undefined,
        expiresInHours,
      }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) throw new Error(saveData?.error?.message ?? saveData?.error ?? "Failed to save recipients.");

    const detailRes = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, { cache: "no-store" });
    const detailData = await detailRes.json().catch(() => ({}));
    if (!detailRes.ok) {
      throw new Error(detailData?.error?.message ?? detailData?.error ?? "Failed to load request detail.");
    }

    const normalized = normalizeDetail(detailData);
    if (normalized.pages.length > 0) {
      setPages(
        normalized.pages.map((page) => ({
          page: page.page,
          widthPts: page.widthPts,
          heightPts: page.heightPts,
        }))
      );
      setDetailPages(normalized.pages);
    }
    setSavedRecipients(normalized.recipients);
    setPlacedFields(normalized.fields);
    if (normalized.recipients.length > 0) {
      setActiveRecipientId(normalized.recipients[0].id);
    }
    if (normalized.pages.length > 0) {
      setActivePage(normalized.pages[0].page);
    }
    if (normalized.blobUrl) setDocumentBlobUrl(normalized.blobUrl);

    if (templateInstanceId && normalized.recipients.length > 0 && normalized.fields.length === 0) {
      const first = normalized.recipients[0]?.id;
      const second = normalized.recipients[1]?.id ?? first;
      if (first) {
        const roleMap: Record<string, string> = {
          RECIPIENT: first,
          CLIENT: first,
          BUYER: first,
          PARTY_A: first,
          PARTY_ONE: first,
          SIGNER_1: first,
          SELLER: second ?? first,
          PARTY_B: second ?? first,
          PARTY_TWO: second ?? first,
          SIGNER_2: second ?? first,
          SENDER: second ?? first,
        };
        const defaultsRes = await fetch(
          `/api/document-templates/instances/${encodeURIComponent(templateInstanceId)}/apply-signing-defaults`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipientRoleMap: roleMap }),
          },
        );
        const defaultsData = await defaultsRes.json().catch(() => ({}));
        if (!defaultsRes.ok) {
          throw new Error(defaultsData?.error?.message ?? defaultsData?.error ?? "Failed to apply template signing defaults.");
        }

        if ((defaultsData?.created ?? 0) > 0) {
          const refreshedRes = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}`, { cache: "no-store" });
          const refreshedData = await refreshedRes.json().catch(() => ({}));
          if (!refreshedRes.ok) {
            throw new Error(refreshedData?.error?.message ?? refreshedData?.error ?? "Failed to refresh signing fields.");
          }
          const refreshed = normalizeDetail(refreshedData);
          if (refreshed.fields.length > 0) {
            setPlacedFields(refreshed.fields);
          }
        }
      }
    }
  }

  async function saveFieldsAndContinue() {
    if (!requestId) {
      setError("Missing request ID.");
      return;
    }
    if (placedFields.length === 0) {
      setError("Place at least one field before continuing.");
      return;
    }
    setSaveBusy(true);
    setError(null);
    try {
      const payload = {
        fields: placedFields.map((field) => ({
          type: field.type,
          recipientId: field.recipientId,
          page: field.page,
          x: Number(field.x.toFixed(6)),
          y: Number(field.y.toFixed(6)),
          width: Number(field.width.toFixed(6)),
          height: Number(field.height.toFixed(6)),
          required: field.required,
          ...(field.options && field.options.length > 0 ? { options: field.options } : {}),
        })),
      };
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message ?? data?.error ?? "Failed to save fields.");
      }
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save fields.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function sendRequest() {
    if (!requestId) {
      setError("Missing request ID.");
      return;
    }
    setSendBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}/send`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message ?? data?.error ?? "Failed to send request.");
      }

      // If public mode, auto-create a public signing link using the placeholder recipient
      if (isPublicMode) {
        const plRes = await fetch(`/api/signing/requests/${encodeURIComponent(requestId)}/public-links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireName: true, requireEmail: false }),
        });
        const plData = await plRes.json().catch(() => ({}));
        if (plRes.ok) {
          const token = (plData as { link?: { token?: string } }).link?.token;
          if (token) {
            setCreatedPublicLinkUrl(`${window.location.origin}/sign/public/${token}`);
            setSendBusy(false);
            return; // stay on page to show the link
          }
        }
        // fallback: go to dashboard even if link creation fails
        window.location.href = "/dashboard/signing";
        return;
      }

      if (data?.emailWarning) {
        setError(`Request sent. Warning: ${data.emailWarning}`);
        setSendBusy(false);
        setTimeout(() => { window.location.href = "/dashboard/signing"; }, 4000);
        return;
      }
      if (data?.emailConfigured === false) {
        setError(
          "Request sent successfully, but email delivery is not configured (RESEND_API_KEY missing). Recipients will not receive automated emails — share the signing link manually."
        );
        setSendBusy(false);
        setTimeout(() => { window.location.href = "/dashboard/signing"; }, 4000);
        return;
      }
      window.location.href = "/dashboard/signing";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setSendBusy(false);
    }
  }

  function placeFieldOnPage(page: number, event: React.MouseEvent<HTMLDivElement>) {
    if (!activeRecipientId) return;
    const target = pageRefs.current[page];
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / rect.width;
    const clickY = (event.clientY - rect.top) / rect.height;
    const size = defaultFieldSize(activeFieldType);

    const newField: PlacedField = {
      id: crypto.randomUUID(),
      type: activeFieldType,
      recipientId: activeRecipientId,
      page,
      x: clamp(clickX - size.width / 2, 0, 1 - size.width),
      y: clamp(clickY - size.height / 2, 0, 1 - size.height),
      width: size.width,
      height: size.height,
      required: true,
      ...(activeFieldType === "RADIO" || activeFieldType === "DROPDOWN" ? { options: ["Option A", "Option B"] } : {}),
    };

    setPlacedFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  }

  function beginDrag(event: React.MouseEvent, field: PlacedField, mode: "move" | "resize") {
    event.preventDefault();
    event.stopPropagation();
    const pageNode = pageRefs.current[field.page];
    if (!pageNode) return;
    const pageRect = pageNode.getBoundingClientRect();
    dragStateRef.current = {
      mode,
      fieldId: field.id,
      pageRect,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: field.x,
      startY: field.y,
      startWidth: field.width,
      startHeight: field.height,
    };
    setSelectedFieldId(field.id);
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", stopDrag);
  }

  function onFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void uploadPdf(file);
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingUpload(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void uploadPdf(file);
  }

  function updateRecipient(id: string, patch: Partial<RecipientDraft>) {
    setRecipients((prev) => prev.map((recipient) => (recipient.id === id ? { ...recipient, ...patch } : recipient)));
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => (prev.length === 1 ? prev : prev.filter((recipient) => recipient.id !== id)));
  }

  function canContinueFromStep1() {
    return Boolean(requestId && pages.length > 0);
  }

  function canContinueFromStep2() {
    if (isPublicMode) return true;
    const filled = recipients.filter((recipient) => recipient.name.trim() || recipient.email.trim());
    if (filled.length === 0) return false;
    return filled.every((recipient) => recipient.name.trim() && recipient.email.trim());
  }

  async function goNext() {
    if (step === 1) {
      if (!canContinueFromStep1()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canContinueFromStep2()) return;
      setBusy(true);
      setError(null);
      try {
        await saveRecipientsAndLoadDetail();
        setStep(3);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to prepare field placement.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 3) {
      await saveFieldsAndContinue();
      return;
    }
    if (step === 4) {
      window.location.href = "/dashboard/signing";
    }
  }

  function goBack() {
    if (step === 1) return;
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/signing">
              <ArrowLeft className="w-4 h-4" />
              Back to Signing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">New Agreement</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
            {isDocumentTemplateMode
              ? "Template loaded — add recipients, review fields, then send."
              : "Upload a document, add recipients, place signature fields, then send."}
          </p>
        </div>
      </div>

      {/* Step indicator — thin progress bar + dot trail */}
      <div className="space-y-3">
        <div className="relative h-0.5 w-full rounded-full bg-border/60 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: progressWidth }}
          />
        </div>
        <div className="flex items-center justify-between">
          {STEPS.map((item) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { if (item.id <= step) setStep(item.id); }}
                className={cn(
                  "flex flex-col items-center gap-1.5 group transition-opacity",
                  item.id > step ? "opacity-40 cursor-default" : "opacity-100 cursor-pointer"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200",
                    done
                      ? "bg-emerald-500 shadow-sm"
                      : active
                      ? "bg-primary shadow-md shadow-primary/30 ring-4 ring-primary/15"
                      : "bg-border/60"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <span className={cn("text-[11px] font-bold", active ? "text-white" : "text-muted-foreground")}>
                      {item.id}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-wide hidden sm:block",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          {isDocumentTemplateMode && requestId ? (
            <div className="rounded-2xl border border-blue-200/60 bg-blue-50 px-5 py-4 text-sm text-blue-700 shadow-sm">
              Document template mode: this request already has a generated PDF attached.
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Document details</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Give this agreement a name and set how long recipients have to sign.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-sm font-medium">Request title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Client Service Agreement"
                  className="h-11 rounded-xl border-border/60 bg-background focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresIn" className="text-sm font-medium">Signing deadline</Label>
                <select
                  id="expiresIn"
                  value={expiresInHours}
                  onChange={(event) => setExpiresInHours(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Upload document</h2>
              <p className="text-sm text-muted-foreground mt-0.5">PDF, Word (.doc/.docx), or image — up to 50 MB.</p>
            </div>
            <div
              onDragOver={(event) => { event.preventDefault(); setDraggingUpload(true); }}
              onDragLeave={() => setDraggingUpload(false)}
              onDrop={onDrop}
              className={cn(
                "rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200 cursor-pointer",
                draggingUpload
                  ? "border-primary bg-primary/5 shadow-inner"
                  : "border-border/50 hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                draggingUpload ? "bg-primary/10" : "bg-muted"
              )}>
                <UploadCloud className={cn("w-6 h-6 transition-colors", draggingUpload ? "text-primary" : "text-muted-foreground")} />
              </div>
              <p className="text-sm font-semibold text-foreground">Drop your document here</p>
              <p className="text-xs text-muted-foreground mt-1.5">PDF, Word (.doc/.docx), or image — or click to browse</p>
              <label className="mt-5 inline-flex">
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.tiff,.bmp,.heic" className="hidden" onChange={onFileInputChange} />
                <span className="inline-flex items-center justify-center rounded-lg border border-border/60 bg-background px-4 py-2 text-sm font-medium cursor-pointer hover:bg-muted/60 transition-colors shadow-sm">
                  Choose file
                </span>
              </label>
            </div>

            {busy && uploadStatus && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground px-1">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>
                  {uploadStatus === "converting"
                    ? "Converting to PDF…"
                    : "Uploading document…"}
                </span>
              </div>
            )}

            {fileName && pages.length > 0 && (
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pages.length} page{pages.length === 1 ? "" : "s"} detected
                  </p>
                  {documentBlobUrl && (
                    <a href={documentBlobUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1.5 inline-block">
                      Open uploaded PDF ↗
                    </a>
                  )}
                  {documentHash && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5 break-all font-mono">SHA: {documentHash.slice(0, 32)}…</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {/* Signer type toggle */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Who is signing?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Send to named recipients or create an open public link.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPublicMode(false)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all duration-150",
                  !isPublicMode
                    ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                    : "border-border/50 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", !isPublicMode ? "bg-primary/10" : "bg-muted")}>
                  <Users className={cn("w-4 h-4", !isPublicMode ? "text-primary" : "text-muted-foreground")} />
                </div>
                <p className="text-sm font-semibold text-foreground">Named Recipients</p>
                <p className="text-xs text-muted-foreground mt-0.5">Send to specific people by email</p>
              </button>
              <button
                type="button"
                onClick={() => setIsPublicMode(true)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all duration-150",
                  isPublicMode
                    ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                    : "border-border/50 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", isPublicMode ? "bg-primary/10" : "bg-muted")}>
                  <Globe className={cn("w-4 h-4", isPublicMode ? "text-primary" : "text-muted-foreground")} />
                </div>
                <p className="text-sm font-semibold text-foreground">Public Link</p>
                <p className="text-xs text-muted-foreground mt-0.5">Anyone with the link can sign</p>
              </button>
            </div>
          </div>

          {isPublicMode ? (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Public signing link</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    After sending, a shareable link will be generated. Anyone who opens it can sign — no email required.
                  </p>
                  <div className="mt-3 rounded-xl bg-muted/50 border border-border/40 px-4 py-3 text-sm text-muted-foreground">
                    In the next step, place fields for the <span className="font-semibold text-foreground">Public Signer</span> slot — they&apos;ll be cloned for each person who uses the link.
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Recipients</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Add the people who need to sign.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setRecipients((prev) => [...prev, makeRecipient()])}>
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
                {session?.user && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      const alreadyAdded = recipients.some(
                        (r) => r.email.toLowerCase() === (session.user?.email ?? "").toLowerCase()
                      );
                      if (!alreadyAdded) {
                        setRecipients((prev) => [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            name: session.user?.name ?? "",
                            email: session.user?.email ?? "",
                            phone: "",
                          },
                        ]);
                      }
                    }}
                  >
                    Add Myself
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {recipients.map((recipient, index) => (
                <div key={recipient.id} className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipient {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecipient(recipient.id)}
                      disabled={recipients.length === 1}
                      className="text-muted-foreground hover:text-destructive -mr-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Name</Label>
                      <Input
                        value={recipient.name}
                        onChange={(event) => updateRecipient(recipient.id, { name: event.target.value })}
                        placeholder="Full name"
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        value={recipient.email}
                        onChange={(event) => updateRecipient(recipient.id, { email: event.target.value })}
                        placeholder="name@email.com"
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>
                  </div>
                  {authLevel === "SMS_OTP" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        Phone <span className="text-muted-foreground font-normal">(required for SMS OTP)</span>
                      </Label>
                      <Input
                        type="tel"
                        value={recipient.phone}
                        onChange={(event) => updateRecipient(recipient.id, { phone: event.target.value })}
                        placeholder="+1 555 000 0000"
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          )} {/* end isPublicMode ternary */}

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Configure signing workflow, authentication, and notifications.</p>
            </div>

            {!isPublicMode && (<>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Signing order</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setSigningMode("PARALLEL")}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm text-left transition-all",
                    signingMode === "PARALLEL"
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50 hover:border-border hover:bg-muted/30"
                  )}
                >
                  <p className="font-semibold text-foreground">Parallel</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All sign at the same time</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSigningMode("SEQUENTIAL")}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm text-left transition-all",
                    signingMode === "SEQUENTIAL"
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50 hover:border-border hover:bg-muted/30"
                  )}
                >
                  <p className="font-semibold text-foreground">Sequential</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sign one after another</p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Authentication</Label>
              <div className="space-y-2 mt-1">
                {(
                  [
                    {
                      value: "LINK_ONLY" as AuthLevel,
                      label: "Link only",
                      description: "Recipient accesses via secure link",
                    },
                    {
                      value: "EMAIL_OTP" as AuthLevel,
                      label: "Email OTP",
                      description: "Verify with a 6-digit code sent to their email",
                    },
                    {
                      value: "SMS_OTP" as AuthLevel,
                      label: "SMS OTP",
                      description: "Verify with a 6-digit code sent to their phone",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAuthLevel(opt.value)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-sm text-left transition-all",
                      authLevel === opt.value
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <p className="font-semibold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
              {authLevel === "SMS_OTP" && (
                <p className="text-xs text-amber-700 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                  Ensure phone numbers are entered for all recipients.
                </p>
              )}
            </div>
            </>)} {/* end !isPublicMode */}

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CC emails</Label>
                <Input
                  value={ccInput}
                  onChange={(event) => setCcInput(event.target.value)}
                  placeholder="manager@co.com, ops@co.com"
                  className="h-11 rounded-xl border-border/60 bg-background"
                />
                {ccEmails.length > 0 && <p className="text-xs text-muted-foreground">{ccEmails.length} CC email(s)</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Signing deadline</Label>
                <select
                  value={expiresInHours}
                  onChange={(event) => setExpiresInHours(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-sm font-medium">Message to recipients</Label>
              <textarea
                id="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                placeholder="Add context or instructions for your recipients…"
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid lg:grid-cols-[272px_1fr] gap-6 items-start">
          <aside className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 space-y-5 lg:sticky lg:top-6">
            {/* Recipients */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Signing for</p>
              <div className="space-y-1.5">
                {savedRecipients.map((recipient) => {
                  const idx = recipientColorIndexById.get(recipient.id) ?? 0;
                  const colors = RECIPIENT_STYLES[idx];
                  return (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => setActiveRecipientId(recipient.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                        activeRecipientId === recipient.id
                          ? `${colors.chip} border shadow-sm`
                          : "border-border/50 hover:bg-muted/40"
                      )}
                    >
                      <p className="font-semibold truncate">{recipient.name}</p>
                      <p className="text-[11px] opacity-70 truncate mt-0.5">{recipient.email}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field type picker */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Field type</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FIELD_TYPES.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setActiveFieldType(item.type)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium text-left transition-all",
                      activeFieldType === item.type
                        ? "border-primary/40 bg-primary/5 text-primary shadow-sm"
                        : "border-border/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
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
                <div className="pt-4 border-t border-border/40 space-y-4">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Selected field</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground block">Field type</label>
                    <select
                      value={sel.type}
                      onChange={(e) => updateField(sel.id, { type: e.target.value as FieldType })}
                      className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.type} value={t.type}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground block">Assigned to</label>
                    <select
                      value={sel.recipientId}
                      onChange={(e) => updateField(sel.id, { recipientId: e.target.value })}
                      className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {savedRecipients.map((r, i) => (
                        <option key={r.id} value={r.id}>
                          {r.name || r.email} {signingMode === "SEQUENTIAL" ? `(Signer ${i + 1})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Required</label>
                    <button
                      type="button"
                      onClick={() => updateField(sel.id, { required: !sel.required })}
                      className={cn("w-9 h-5 rounded-full transition-colors", sel.required ? "bg-primary" : "bg-muted")}
                    >
                      <span className={cn("block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform mx-0.5", sel.required ? "translate-x-4" : "translate-x-0")} />
                    </button>
                  </div>
                  {sel.type === "ATTACHMENT" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground block">Instructions for signer</label>
                      <input
                        type="text"
                        value={sel.options?.[0] ?? ""}
                        onChange={(e) =>
                          updateField(sel.id, { options: e.target.value.trim() ? [e.target.value] : undefined })
                        }
                        placeholder="e.g. Upload your driver's license"
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-2 text-sm focus:outline-none"
                      />
                      <p className="text-[11px] text-muted-foreground">Shown above the upload button.</p>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full rounded-lg"
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

            <div className="space-y-2 pt-4 border-t border-border/40">
              <Button type="button" className="w-full rounded-xl" onClick={saveFieldsAndContinue} disabled={saveBusy || placedFields.length === 0}>
                {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Click the document to place a field. Drag to move, corner handle to resize.
              </p>
            </div>
          </aside>

          <div ref={placementScrollRef} className="space-y-4 pr-1">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Field Placement</h2>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPlacementViewMode("CLICK")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-sm transition-colors",
                      placementViewMode === "CLICK"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Click-through
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlacementViewMode("SCROLL")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-sm transition-colors",
                      placementViewMode === "SCROLL"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Scroll
                  </button>
                </div>
                {placementViewMode === "CLICK" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activePageIndex <= 0}
                      onClick={() => {
                        if (activePageIndex <= 0) return;
                        setActivePage(displayPages[activePageIndex - 1].page);
                      }}
                    >
                      Prev Page
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {activePageIndex >= 0 ? activePageIndex + 1 : 1} / {displayPages.length || 1}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activePageIndex < 0 || activePageIndex >= displayPages.length - 1}
                      onClick={() => {
                        if (activePageIndex < 0 || activePageIndex >= displayPages.length - 1) return;
                        setActivePage(displayPages[activePageIndex + 1].page);
                      }}
                    >
                      Next Page
                    </Button>
                  </>
                )}
                {placementViewMode === "SCROLL" && (
                  <span className="text-xs text-muted-foreground">
                    Scroll pages and click anywhere to place fields.
                  </span>
                )}
              </div>
            </div>

            {displayPages.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {displayPages.map((pageData, idx) => (
                  <button
                    key={`jump-${pageData.page}`}
                    type="button"
                    onClick={() => setActivePage(pageData.page)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md border text-xs transition-colors",
                      pageData.page === activePage
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    Page {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {placementViewMode === "CLICK" && activePageData && (
              <div
                key={activePageData.page}
                className={cn(
                  "rounded-xl border overflow-hidden bg-card",
                  "border-primary/40 shadow-sm"
                )}
              >
                <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
                  Page {activePageIndex >= 0 ? activePageIndex + 1 : 1}
                </div>
                <div
                  ref={(node) => {
                    pageRefs.current[activePageData.page] = node;
                  }}
                  className="relative w-full select-none"
                  style={{ aspectRatio: `${activePageData.widthPts} / ${activePageData.heightPts}` }}
                  onClick={(event) => {
                    setActivePage(activePageData.page);
                    placeFieldOnPage(activePageData.page, event);
                  }}
                >
                  {activePageData.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activePageData.imageUrl} alt={`Page ${activePageData.page}`} className="absolute inset-0 w-full h-full object-contain bg-white" />
                  ) : documentBlobUrl ? (
                    <iframe
                      src={`${documentBlobUrl}#page=${activePageData.page}&toolbar=0&navpanes=0&scrollbar=0`}
                      className="absolute inset-0 w-full h-full border-none bg-white"
                      style={{ pointerEvents: "none" }}
                      title={`Page ${activePageData.page}`}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-white" />
                  )}

                  <div className="absolute inset-0">
                    {placedFields
                      .filter((field) => field.page === activePageData.page)
                      .map((field) => {
                        const recipient = savedRecipients.find((item) => item.id === field.recipientId);
                        const colorIdx = recipientColorIndexById.get(field.recipientId) ?? 0;
                        const colors = RECIPIENT_STYLES[colorIdx];
                        return (
                          <div
                            key={field.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedFieldId(field.id);
                            }}
                            onMouseDown={(event) => beginDrag(event, field, "move")}
                            className={cn(
                              "absolute rounded-md border-2 cursor-move flex items-center justify-between px-2 text-[10px] font-medium overflow-hidden",
                              colors.border,
                              colors.bg,
                              colors.text,
                              selectedFieldId === field.id ? "ring-2 ring-primary/40" : ""
                            )}
                            style={{
                              left: `${field.x * 100}%`,
                              top: `${field.y * 100}%`,
                              width: `${field.width * 100}%`,
                              height: `${field.height * 100}%`,
                              minWidth: "50px",
                              minHeight: "22px",
                            }}
                          >
                            <span className="truncate">
                              {FIELD_TYPES.find((item) => item.type === field.type)?.label ?? field.type}
                            </span>
                            <span className="truncate opacity-80 ml-1">
                              {recipient?.name ?? "Recipient"}
                            </span>
                            <button
                              type="button"
                              onMouseDown={(event) => beginDrag(event, field, "resize")}
                              onClick={(event) => event.stopPropagation()}
                              className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-foreground/40 cursor-se-resize"
                              aria-label="Resize field"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {placementViewMode === "SCROLL" &&
              displayPages.map((pageData, idx) => (
                <div
                  key={pageData.page}
                  className={cn(
                    "rounded-xl border overflow-hidden bg-card",
                    activePage === pageData.page ? "border-primary/40 shadow-sm" : "border-border"
                  )}
                >
                  <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
                    Page {idx + 1}
                  </div>
                  <div
                    ref={(node) => {
                      pageRefs.current[pageData.page] = node;
                    }}
                    className="relative w-full select-none"
                    style={{ aspectRatio: `${pageData.widthPts} / ${pageData.heightPts}` }}
                    onClick={(event) => {
                      setActivePage(pageData.page);
                      placeFieldOnPage(pageData.page, event);
                    }}
                  >
                    {pageData.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pageData.imageUrl} alt={`Page ${pageData.page}`} className="absolute inset-0 w-full h-full object-contain bg-white" />
                    ) : documentBlobUrl ? (
                      <iframe
                        src={`${documentBlobUrl}#page=${pageData.page}&toolbar=0&navpanes=0&scrollbar=0`}
                        className="absolute inset-0 w-full h-full border-none bg-white"
                        style={{ pointerEvents: "none" }}
                        title={`Page ${pageData.page}`}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-white" />
                    )}

                    <div className="absolute inset-0">
                      {placedFields
                        .filter((field) => field.page === pageData.page)
                        .map((field) => {
                          const recipient = savedRecipients.find((item) => item.id === field.recipientId);
                          const colorIdx = recipientColorIndexById.get(field.recipientId) ?? 0;
                          const colors = RECIPIENT_STYLES[colorIdx];
                          return (
                            <div
                              key={field.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedFieldId(field.id);
                              }}
                              onMouseDown={(event) => beginDrag(event, field, "move")}
                              className={cn(
                                "absolute rounded-md border-2 cursor-move flex items-center justify-between px-2 text-[10px] font-medium overflow-hidden",
                                colors.border,
                                colors.bg,
                                colors.text,
                                selectedFieldId === field.id ? "ring-2 ring-primary/40" : ""
                              )}
                              style={{
                                left: `${field.x * 100}%`,
                                top: `${field.y * 100}%`,
                                width: `${field.width * 100}%`,
                                height: `${field.height * 100}%`,
                                minWidth: "50px",
                                minHeight: "22px",
                              }}
                            >
                              <span className="truncate">
                                {FIELD_TYPES.find((item) => item.type === field.type)?.label ?? field.type}
                              </span>
                              <span className="truncate opacity-80 ml-1">
                                {recipient?.name ?? "Recipient"}
                              </span>
                              <button
                                type="button"
                                onMouseDown={(event) => beginDrag(event, field, "resize")}
                                onClick={(event) => event.stopPropagation()}
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
      )}

      {step === 4 && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-7 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Ready to send?</h2>
            <p className="text-sm text-muted-foreground mt-1">Review everything before sending the agreement out for signatures.</p>
          </div>

          {/* Document name */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{title.trim() || fileName || "Untitled request"}</p>
              {fileName && title.trim() && <p className="text-xs text-muted-foreground mt-0.5 truncate">{fileName}</p>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Recipients", value: String(recipientListForReview.length) },
              { label: "Fields placed", value: String(placedFields.length) },
              { label: "Signing order", value: isPublicMode ? "Public link" : signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel" },
              { label: "Authentication", value: isPublicMode ? "Open" : authLevel === "EMAIL_OTP" ? "Email OTP" : authLevel === "SMS_OTP" ? "SMS OTP" : "Link only" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/40 bg-muted/20 p-3.5">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                <p className="text-sm font-semibold text-foreground mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Field coverage per recipient */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Field coverage</p>
              <p className="text-xs text-muted-foreground">Expires: {expiresAtPreview}</p>
            </div>
            <div className="space-y-2">
              {recipientListForReview.map((recipient) => {
                const count = fieldCountByRecipient.get(recipient.id) ?? 0;
                return (
                  <div key={recipient.id} className="rounded-xl border border-border/40 px-4 py-3 flex items-center justify-between gap-3 bg-muted/10">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{recipient.email}</p>
                    </div>
                    <Badge className={cn("font-semibold", count > 0 ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" : "bg-red-500/10 text-red-700 border-red-200")}>
                      {count} field{count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {recipientsMissingFields.length > 0 && (
            <div className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">
              Assign at least one field to every recipient before sending.
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={sendRequest}
              disabled={sendBusy || !!createdPublicLinkUrl || recipientsMissingFields.length > 0 || recipientListForReview.length === 0}
              className="h-11 px-6 rounded-xl gap-2 text-sm font-semibold"
            >
              {sendBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : isPublicMode ? <Globe className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {isPublicMode ? (createdPublicLinkUrl ? "Public Link Created" : "Send & Create Public Link") : "Send for Signature"}
            </Button>
          </div>
        </div>
      )}

      {/* Public link success */}
      {createdPublicLinkUrl && (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Public signing link created</p>
              <p className="text-xs text-emerald-700 mt-0.5">Anyone with this link can open and sign the document.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={createdPublicLinkUrl}
              className="flex-1 h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-mono text-foreground"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 gap-1.5 rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-100"
              onClick={async () => {
                await navigator.clipboard.writeText(createdPublicLinkUrl).catch(() => {});
                setCopiedPublicLink(true);
                setTimeout(() => setCopiedPublicLink(false), 2000);
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedPublicLink ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            onClick={() => { window.location.href = "/dashboard/signing"; }}
          >
            Go to Agreements
          </Button>
        </div>
      )}

      {!createdPublicLinkUrl && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 1 || busy || saveBusy || sendBusy}
            className="h-11 px-5 rounded-xl"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={goNext}
            disabled={
              busy ||
              saveBusy ||
              sendBusy ||
              (step === 1 && !canContinueFromStep1()) ||
              (step === 2 && !canContinueFromStep2()) ||
              (step === 3 && placedFields.length === 0)
            }
            className="h-11 px-6 rounded-xl font-semibold"
          >
            {busy || saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {step === 3 ? "Save & Continue" : step === 4 ? "Done" : "Continue"}
          </Button>
        </div>
      )}
    </div>
  );
}
