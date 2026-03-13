"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, X, CheckCircle2, Loader2, Copy, CheckCheck,
  Plus, FolderUp, Eye, Mail, Clock, Bell, AlertCircle,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_FILES = 50;

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

interface FileEntry {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  blobUrl?: string;
  error?: string;
}

interface CreatedTransfer {
  url: string;
  token: string;
}

// Read all files from a dropped item, recursively traversing folders
async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (f) => resolve([f]),
        () => resolve([])
      );
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const allFiles: File[] = [];
    await new Promise<void>((resolve) => {
      function readBatch() {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) { resolve(); return; }
          for (const e of entries) {
            const nested = await readEntry(e);
            allFiles.push(...nested);
          }
          readBatch();
        }, () => resolve());
      }
      readBatch();
    });
    return allFiles;
  }
  return [];
}

export default function NewTransferPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
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

  // Upload progress tracking
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const uploadStartRef = useRef<number>(0);
  const [eta, setEta] = useState("");

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
  const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  // Update ETA every second during upload
  useEffect(() => {
    if (!uploading || uploadedBytes === 0) return;
    const elapsed = (Date.now() - uploadStartRef.current) / 1000;
    const speed = uploadedBytes / elapsed;
    const remaining = totalBytes - uploadedBytes;
    setEta(fmtEta(remaining / speed));
  }, [uploadedBytes, uploading, totalBytes]);

  function addFiles(incoming: File[]) {
    const filtered = incoming.filter((f) => f.size <= MAX_FILE_BYTES && f.size > 0);
    setFiles((prev) =>
      [...prev, ...filtered.map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        progress: 0,
        status: "pending" as const,
      }))].slice(0, MAX_FILES)
    );
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const allFiles: File[] = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const nested = await readEntry(entry);
        allFiles.push(...nested);
      } else if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) allFiles.push(f);
      }
    }

    addFiles(allFiles);
  }, []);

  async function handleSubmit() {
    if (files.length === 0 || uploading) return;
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError("Total size exceeds 10 GB.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadedBytes(0);
    setCurrentFileIndex(0);
    uploadStartRef.current = Date.now();

    const uploadedFiles: Array<{ fileName: string; mimeType: string; sizeBytes: number; blobUrl: string }> = [];
    let bytesBeforeThisFile = 0;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      setCurrentFileIndex(i);
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "uploading" } : f));

      try {
        const blob = await upload(entry.file.name, entry.file, {
          access: "public",
          handleUploadUrl: "/api/transfers/blob",
          onUploadProgress: ({ percentage }) => {
            const fileBytes = entry.file.size * (percentage / 100);
            setUploadedBytes(bytesBeforeThisFile + fileBytes);
            setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: percentage } : f));
          },
        });

        bytesBeforeThisFile += entry.file.size;
        setUploadedBytes(bytesBeforeThisFile);
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "done", progress: 100, blobUrl: blob.url } : f));
        uploadedFiles.push({
          fileName: entry.file.name,
          mimeType: entry.file.type || "application/octet-stream",
          sizeBytes: entry.file.size,
          blobUrl: blob.url,
        });
      } catch {
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "error", error: "Upload failed" } : f));
        setUploading(false);
        setError("One or more files failed to upload. Please try again.");
        return;
      }
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

    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? "Failed to create transfer.");
      setUploading(false);
      return;
    }

    setCreated({ url: data.url, token: data.token });
    setUploading(false);
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Upload progress screen ────────────────────────────────────────────────
  if (uploading) {
    const doneCount = files.filter((f) => f.status === "done").length;

    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-200">
          <Upload className="w-8 h-8 text-blue-500" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">Uploading your files</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Please keep this tab open until the upload finishes.
        </p>

        {/* Overall progress */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-4 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">
              {doneCount} of {files.length} files
            </span>
            <span className="text-sm font-semibold text-blue-500">{overallProgress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-blue-100 overflow-hidden mb-1.5">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fmtBytes(uploadedBytes)} of {fmtBytes(totalBytes)}</span>
            <span>{eta}</span>
          </div>
        </div>

        {/* Per-file list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {files.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-card text-left transition-opacity ${
                i > currentFileIndex + 1 ? "opacity-40" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{entry.file.name}</p>
                {entry.status === "uploading" && (
                  <div className="mt-1 h-1 rounded-full bg-blue-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-200"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                )}
                {entry.status === "done" && (
                  <div className="mt-1 h-1 rounded-full bg-emerald-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
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

  // ── Success screen ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Transfer Ready</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Share this link with anyone — they can download your files directly.
        </p>
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Your transfer link</p>
          <p className="font-mono text-sm text-foreground break-all mb-3">{created.url}</p>
          <Button onClick={handleCopy} className="w-full gap-2">
            {copied ? <><CheckCheck className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy Link</>}
          </Button>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => {
            setCreated(null); setFiles([]); setTitle(""); setMessage(""); setRecipientEmails([""]);
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

  // ── Form ──────────────────────────────────────────────────────────────────
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
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            dragging ? "border-blue-400 bg-blue-50" : "border-border hover:border-blue-300 hover:bg-blue-50/30"
          }`}
        >
          <FolderUp className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Drop files or folders here, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Up to {MAX_FILES} files · 2 GB per file · 10 GB total</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {files.length} file{files.length !== 1 ? "s" : ""} · {fmtBytes(totalBytes)}
              </p>
              {totalBytes > MAX_TOTAL_BYTES && (
                <p className="text-xs text-red-500 font-medium">Exceeds 10 GB limit</p>
              )}
            </div>
            {files.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtBytes(entry.file.size)}</p>
                  {entry.status === "error" && <p className="text-xs text-red-500 mt-0.5">{entry.error}</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Title */}
        <div>
          <Label htmlFor="title" className="text-sm font-medium">
            Title <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Spring Ad Campaign Videos"
            className="mt-1.5"
            maxLength={120}
          />
        </div>

        {/* Message */}
        <div>
          <Label htmlFor="message" className="text-sm font-medium">
            Message <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
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

        {/* Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />Expires after
            </Label>
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
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />View once only
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setNotifyOnDownload((v) => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${notifyOnDownload ? "bg-blue-500" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifyOnDownload ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />Notify me on download
              </span>
            </label>
          </div>
        </div>

        {/* Recipient emails */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />Send to <span className="text-muted-foreground font-normal ml-1">(optional)</span>
          </Label>
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
            {error}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={files.length === 0 || totalBytes > MAX_TOTAL_BYTES}
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
