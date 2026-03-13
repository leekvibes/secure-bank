"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  Copy,
  CheckCheck,
  Plus,
  FolderUp,
  Eye,
  Mail,
  Clock,
  Bell,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_FILES = 50;
const STALL_UI_MS = 15_000;
const STALL_RETRY_MS = 90_000;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "Calculating…";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`;
  return `${(seconds / 3600).toFixed(1)}h left`;
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

interface FileEntry {
  id: string;
  file: File;
  relativePath: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  retries: number;
  startedAtMs?: number;
  lastProgressAtMs?: number;
  stalled?: boolean;
  blobUrl?: string;
  error?: string;
}

interface IncomingFile {
  file: File;
  relativePath?: string;
}

interface CreatedTransfer {
  url: string;
  token: string;
}

function normalizeRelativePath(file: File, relativePath?: string): string {
  const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  const path = relativePath?.trim() || webkitPath?.trim() || file.name;
  return path.replace(/^\/+/, "");
}

function buildUniqueBlobPath(relativePath: string): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${rand}/${relativePath.replace(/^\/+/, "")}`;
}

async function readEntry(entry: FileSystemEntry, parentPath = ""): Promise<IncomingFile[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (f) => resolve([{ file: f, relativePath: normalizeRelativePath(f, `${parentPath}${entry.name}`) }]),
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const out: IncomingFile[] = [];

    await new Promise<void>((resolve) => {
      function readBatch() {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve();
            return;
          }
          for (const nested of entries) {
            const children = await readEntry(nested, `${parentPath}${entry.name}/`);
            out.push(...children);
          }
          readBatch();
        }, () => resolve());
      }
      readBatch();
    });

    return out;
  }

  return [];
}

async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<IncomingFile[]> {
  const items = Array.from(dataTransfer.items || []);
  const allFiles: IncomingFile[] = [];

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      const nested = await readEntry(entry);
      allFiles.push(...nested);
    } else if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) allFiles.push({ file, relativePath: normalizeRelativePath(file) });
    }
  }

  if (allFiles.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({ file, relativePath: normalizeRelativePath(file) }));
  }

  return allFiles;
}

function groupByFolder(entries: FileEntry[]): Record<string, FileEntry[]> {
  return entries.reduce<Record<string, FileEntry[]>>((acc, entry) => {
    const parts = entry.relativePath.split("/");
    const folder = parts.length > 1 ? parts[0] : "__root__";
    acc[folder] ||= [];
    acc[folder].push(entry);
    return acc;
  }, {});
}

export default function NewTransferPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expirationDays, setExpirationDays] = useState(7);
  const [viewOnce, setViewOnce] = useState(false);
  const [notifyOnDownload, setNotifyOnDownload] = useState(true);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([""]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTransfer | null>(null);
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const uploadStartRef = useRef<number>(0);
  const folderPickerProps = {
    webkitdirectory: "",
    directory: "",
  } as Record<string, string>;

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);

  // Derived — no separate state needed
  const uploadedBytes = files.reduce((sum, f) => {
    if (f.status === "done") return sum + f.file.size;
    if (f.status === "uploading") return sum + Math.round(f.file.size * (f.progress / 100));
    return sum;
  }, 0);
  const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
  const eta = uploading && uploadedBytes > 0 ? (() => {
    const elapsed = (Date.now() - uploadStartRef.current) / 1000;
    const speed = uploadedBytes / Math.max(elapsed, 1);
    return fmtEta((totalBytes - uploadedBytes) / speed);
  })() : "";

  useEffect(() => {
    if (!uploading) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setFiles((prev) => {
        let changed = false;
        const next = prev.map((f) => {
          if (f.status !== "uploading") return f;
          const stalled = !!f.lastProgressAtMs && now - f.lastProgressAtMs > STALL_UI_MS;
          if (stalled !== !!f.stalled) {
            changed = true;
            return { ...f, stalled };
          }
          return f;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [uploading]);

  function addFiles(incoming: IncomingFile[]) {
    const rejected: string[] = [];

    setFiles((prev) => {
      const next = [...prev];
      for (const item of incoming) {
        const relPath = normalizeRelativePath(item.file, item.relativePath);
        if (item.file.size <= 0) {
          rejected.push(`${relPath}: empty files are not allowed`);
          continue;
        }
        if (item.file.size > MAX_FILE_BYTES) {
          rejected.push(`${relPath}: exceeds 2 GB per-file limit`);
          continue;
        }
        if (next.length >= MAX_FILES) {
          rejected.push(`${relPath}: max ${MAX_FILES} files per transfer`);
          continue;
        }

        next.push({
          id: Math.random().toString(36).slice(2),
          file: item.file,
          relativePath: relPath,
          progress: 0,
          status: "pending",
          retries: 0,
        });
      }
      return next;
    });

    if (rejected.length) {
      const preview = rejected.slice(0, 3).join(" • ");
      const extra = rejected.length > 3 ? ` (+${rejected.length - 3} more)` : "";
      setError(`Some files were not added: ${preview}${extra}`);
    } else {
      setError(null);
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function resetEntry(id: string) {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: "pending",
              progress: 0,
              retries: 0,
              startedAtMs: undefined,
              lastProgressAtMs: undefined,
              stalled: false,
              error: undefined,
              blobUrl: undefined,
            }
          : f
      )
    );
  }

  function resetAllFailed() {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "error"
          ? {
              ...f,
              status: "pending",
              progress: 0,
              retries: 0,
              startedAtMs: undefined,
              lastProgressAtMs: undefined,
              stalled: false,
              error: undefined,
              blobUrl: undefined,
            }
          : f
      )
    );
    setError(null);
  }

  async function cleanupUploadedBlobs(blobUrls: string[]) {
    if (!blobUrls.length) return;
    await fetch("/api/transfers/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobUrls }),
    }).catch(() => {});
  }

  async function uploadWithInactivityWatchdog(
    entry: FileEntry,
    onProgress: (percentage: number) => void
  ) {
    return await new Promise<{ url: string }>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const clearTimer = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
      };

      const resetTimer = () => {
        clearTimer();
        timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Upload stalled. Retrying automatically..."));
        }, STALL_RETRY_MS);
      };

      resetTimer();

      upload(buildUniqueBlobPath(entry.relativePath), entry.file, {
        access: "public",
        handleUploadUrl: "/api/transfers/blob",
        onUploadProgress: ({ percentage }) => {
          if (settled) return;
          resetTimer();
          onProgress(percentage);
        },
      })
        .then((blob) => {
          if (settled) return;
          settled = true;
          clearTimer();
          resolve({ url: blob.url });
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          clearTimer();
          reject(err);
        });
    });
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = await collectDroppedFiles(e.dataTransfer);
    addFiles(dropped);
  }, []);

  async function handleSubmit() {
    if (files.length === 0 || uploading) return;

    if (totalBytes > MAX_TOTAL_BYTES) {
      setError("Total size exceeds 10 GB.");
      return;
    }

    setUploading(true);
    setError(null);
    uploadStartRef.current = Date.now();

    // Snapshot of already-done files (retry flow)
    const snapshot = [...files];
    // Largest-first reduces the "slow surprise" at the very end.
    const toUpload = snapshot
      .filter((f) => f.status !== "done")
      .sort((a, b) => b.file.size - a.file.size);

    // Reset pending/error files to pending
    setFiles((prev) =>
      prev.map((f) =>
        f.status !== "done"
          ? {
              ...f,
              status: "pending",
              progress: 0,
              stalled: false,
              error: undefined,
            }
          : f
      )
    );

    // Collect results outside React state so we can read them after awaits
    const blobUrls = new Map<string, string>(); // id → blobUrl
    const uploadErrors = new Map<string, string>(); // id → error message

    // Parallel worker pool — 3 concurrent uploads
    const CONCURRENCY = 3;
    let cursor = 0;

    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= toUpload.length) break;
        const entry = toUpload[i];
        let success = false;

        for (let attempt = 0; attempt < 2; attempt++) {
          const startedAt = Date.now();
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? {
                    ...f,
                    status: "uploading",
                    progress: 0,
                    retries: attempt,
                    startedAtMs: f.startedAtMs ?? startedAt,
                    lastProgressAtMs: startedAt,
                    stalled: false,
                    error: undefined,
                  }
                : f
            )
          );

          try {
            const blob = await uploadWithInactivityWatchdog(entry, (percentage) => {
              const now = Date.now();
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === entry.id
                    ? { ...f, progress: percentage, lastProgressAtMs: now, stalled: false }
                    : f
                )
              );
            });

            blobUrls.set(entry.id, blob.url);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === entry.id
                  ? { ...f, status: "done", progress: 100, stalled: false, blobUrl: blob.url }
                  : f
              )
            );
            success = true;
            break;
          } catch (err) {
            const baseMsg = err instanceof Error ? err.message : "Upload failed";
            const shouldRetry = attempt === 0;
            const msg = shouldRetry ? "Slow network detected. Retrying once..." : baseMsg;
            setFiles((prev) =>
              prev.map((f) =>
                f.id === entry.id
                  ? { ...f, status: shouldRetry ? "pending" : "error", stalled: false, error: msg }
                  : f
              )
            );
            if (!shouldRetry) {
              uploadErrors.set(entry.id, baseMsg);
            }
          }
        }

        if (!success && !uploadErrors.has(entry.id)) {
          uploadErrors.set(entry.id, "Upload failed");
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, toUpload.length) }, worker)
    );

    // If any uploads failed, surface errors and let user retry
    if (uploadErrors.size > 0) {
      const count = uploadErrors.size;
      setError(
        `${count} file${count > 1 ? "s" : ""} failed to upload — see errors above. Fix or remove them, then try again.`
      );
      setUploading(false);
      return;
    }

    console.info("[transfers] upload metrics", {
      fileCount: files.length,
      totalBytes,
      durationMs: Date.now() - uploadStartRef.current,
      stalledFiles: files.filter((f) => f.stalled).length,
    });

    // Build file list from pre-existing done files + newly uploaded
    const uploadedFiles = snapshot
      .filter((f) => blobUrls.has(f.id) || (f.status === "done" && f.blobUrl))
      .map((f) => ({
        fileName: f.relativePath,
        mimeType: f.file.type || "application/octet-stream",
        sizeBytes: f.file.size,
        blobUrl: blobUrls.get(f.id) ?? f.blobUrl!,
      }));

    if (uploadedFiles.length === 0) {
      setUploading(false);
      setError("No files were uploaded successfully.");
      return;
    }

    const validEmails = recipientEmails.filter((e) => e.trim() && e.includes("@"));
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || undefined,
        message: message.trim() || undefined,
        viewOnce,
        expirationDays,
        notifyOnDownload,
        recipientEmails: validEmails,
        files: uploadedFiles,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await cleanupUploadedBlobs(uploadedFiles.map((f) => f.blobUrl));
      setError(data.error?.message ?? data.error ?? "Failed to create transfer.");
      setUploading(false);
      return;
    }

    setCreated({ url: data.url, token: data.token });
    setUploading(false);
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Clipboard access failed in this browser.");
    }
  }

  if (uploading) {
    const doneCount = files.filter((f) => f.status === "done").length;
    const errorCount = files.filter((f) => f.status === "error").length;
    const activeCount = files.filter((f) => f.status === "uploading").length;
    const stalledCount = files.filter((f) => f.status === "uploading" && f.stalled).length;
    const finalizing = stalledCount > 0 && doneCount >= files.length - 1;

    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-200">
          <Upload className="w-8 h-8 text-blue-500" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">Uploading your files</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Please keep this tab open.
          {activeCount > 0 && ` Uploading ${activeCount} file${activeCount > 1 ? "s" : ""} at once.`}
          {finalizing && " Finalizing last file..."}
        </p>

        <div className="bg-card rounded-2xl border border-border p-6 mb-4 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">
              {doneCount} of {files.length} files
              {errorCount > 0 && <span className="text-red-500 ml-2">· {errorCount} failed</span>}
            </span>
            <span className="text-sm font-semibold text-blue-500">{overallProgress}%</span>
          </div>
          <div className={`h-2.5 rounded-full bg-blue-100 overflow-hidden mb-1.5 ${stalledCount > 0 ? "animate-pulse" : ""}`}>
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fmtBytes(uploadedBytes)} of {fmtBytes(totalBytes)}</span>
            <span>{stalledCount > 0 ? "Connection slow..." : eta}</span>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {files.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-card text-left ${
                entry.status === "error" ? "border-red-200 bg-red-50/40" : ""
              } ${entry.status === "pending" ? "opacity-40" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{entry.relativePath}</p>
                {entry.status === "uploading" && (
                  <div className="mt-1 h-1 rounded-full bg-blue-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${entry.stalled ? "bg-amber-500 animate-pulse" : "bg-blue-500"}`}
                      style={{ width: `${Math.max(entry.progress, entry.stalled ? 6 : 0)}%` }}
                    />
                  </div>
                )}
                {entry.status === "done" && (
                  <div className="mt-1 h-1 rounded-full bg-emerald-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                )}
                {entry.status === "uploading" && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Elapsed {fmtElapsed(nowMs - (entry.startedAtMs ?? nowMs))}
                    {entry.lastProgressAtMs ? ` · Last update ${fmtElapsed(nowMs - entry.lastProgressAtMs)} ago` : ""}
                    {entry.retries > 0 ? ` · Retry ${entry.retries}/1` : ""}
                    {entry.stalled ? " · Finalizing..." : ""}
                  </p>
                )}
                {entry.status === "error" && entry.error && (
                  <p className="mt-0.5 text-xs text-red-500 break-words">{entry.error}</p>
                )}
              </div>
              <div className="shrink-0">
                {entry.status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : entry.status === "uploading" ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                ) : entry.status === "error" ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (created) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Transfer Ready</h1>
        <p className="text-muted-foreground text-sm mb-6">Share this link with anyone — they can download your files directly.</p>
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Your transfer link</p>
          <p className="font-mono text-sm text-foreground break-all mb-3">{created.url}</p>
          <Button onClick={handleCopy} className="w-full gap-2">
            {copied ? <><CheckCheck className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy Link</>}
          </Button>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => {
            setCreated(null);
            setFiles([]);
            setTitle("");
            setMessage("");
            setRecipientEmails([""]);
            setExpandedFolders({});
          }}>
            New Transfer
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/transfers">View All</Link>
          </Button>
        </div>
      </div>
    );
  }

  const grouped = groupByFolder(files);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/transfers" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">New Transfer</h1>
          <p className="text-xs text-muted-foreground">Upload files and share a secure download link</p>
        </div>
      </div>

      <div className="space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? "border-blue-400 bg-blue-50" : "border-border hover:border-blue-300 hover:bg-blue-50/30"
          }`}
        >
          <FolderUp className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Drop files or folders here, or use the buttons below</p>
          <p className="text-xs text-muted-foreground mt-1">Up to {MAX_FILES} files · 2 GB per file · 10 GB total</p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              Add files
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => folderInputRef.current?.click()}>
              Add folder
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files ?? []).map((file) => ({ file })))}
          />
          <input
            {...folderPickerProps}
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files ?? []).map((file) => ({ file })))}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {files.length} file{files.length !== 1 ? "s" : ""} · {fmtBytes(totalBytes)}
              </p>
              <div className="flex items-center gap-2">
                {files.some((f) => f.status === "error") && (
                  <Button type="button" size="sm" variant="outline" onClick={resetAllFailed}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry failed
                  </Button>
                )}
                {totalBytes > MAX_TOTAL_BYTES && <p className="text-xs text-red-500 font-medium">Exceeds 10 GB limit</p>}
              </div>
            </div>

            {Object.entries(grouped).map(([folder, entries]) => (
              <div key={folder} className="rounded-xl border border-border bg-card">
                {folder !== "__root__" && (
                  <button
                    type="button"
                    onClick={() => setExpandedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }))}
                    className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-border/60 text-left"
                  >
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedFolders[folder] ? "rotate-90" : ""}`} />
                    <FolderUp className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm font-medium">{folder}</span>
                    <span className="text-xs text-muted-foreground">({entries.length} files)</span>
                  </button>
                )}

                {(folder === "__root__" || expandedFolders[folder]) && (
                  <div className="divide-y divide-border/60">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{entry.relativePath.split("/").pop()}</p>
                          <p className="text-xs text-muted-foreground">{entry.relativePath} · {fmtBytes(entry.file.size)}</p>
                          {entry.status === "error" && <p className="text-xs text-red-500 mt-0.5">{entry.error}</p>}
                        </div>

                        {entry.status === "error" ? (
                          <button
                            type="button"
                            onClick={() => resetEntry(entry.id)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />Retry
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(entry.id);
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <Label htmlFor="title" className="text-sm font-medium">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Spring Ad Campaign Videos"
            className="mt-1.5"
            maxLength={120}
          />
        </div>

        <div>
          <Label htmlFor="message" className="text-sm font-medium">Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a note for the recipient..."
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Expires after</Label>
            <select
              value={expirationDays}
              onChange={(e) => setExpirationDays(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setViewOnce((v) => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${viewOnce ? "bg-blue-500" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${viewOnce ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-medium flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-muted-foreground" />View once only</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setNotifyOnDownload((v) => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${notifyOnDownload ? "bg-blue-500" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyOnDownload ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-medium flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-muted-foreground" />Notify me on download</span>
            </label>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Send to <span className="text-muted-foreground font-normal ml-1">(optional)</span></Label>
          <div className="mt-1.5 space-y-2">
            {recipientEmails.map((email, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const next = [...recipientEmails];
                    next[i] = e.target.value;
                    setRecipientEmails(next);
                  }}
                  placeholder="recipient@email.com"
                />
                {recipientEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRecipientEmails(recipientEmails.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {recipientEmails.length < 10 && (
              <button
                type="button"
                onClick={() => setRecipientEmails([...recipientEmails, ""])}
                className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Add another email
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={uploading || files.length === 0 || totalBytes > MAX_TOTAL_BYTES}
          size="lg"
          className="w-full gap-2"
        >
          <Upload className="w-4 h-4" />
          Create Transfer
        </Button>
      </div>
    </div>
  );
}
