"use client";

import { useState } from "react";
import { Download, FileText, Clock, Shield, Eye, CheckCircle2, XCircle, FolderUp } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

function fmtBytes(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface FileEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  downloadCount: number;
}

interface Props {
  token: string;
  title: string | null;
  message: string | null;
  viewOnce: boolean;
  expiresAt: string;
  expired: boolean;
  alreadyDownloaded: boolean;
  files: FileEntry[];
  agent: { displayName: string; company: string | null; photoUrl: string | null };
}

export function TransferDownloadClient({
  token, title, message, viewOnce, expiresAt, expired, alreadyDownloaded, files, agent,
}: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  function getDownloadUrl(fileId: string) {
    return `/api/t/${token}/download/${fileId}`;
  }

  function handleDownload(fileId: string, fileName: string) {
    setDownloading(fileId);
    const a = document.createElement("a");
    a.href = getDownloadUrl(fileId);
    a.download = fileName;
    a.click();
    setTimeout(() => setDownloading(null), 2000);
  }

  function handleDownloadAll() {
    files.forEach((f, i) => {
      setTimeout(() => handleDownload(f.id, f.fileName), i * 300);
    });
  }

  const totalBytes = files.reduce((sum, f) => sum + parseInt(f.sizeBytes, 10), 0);
  const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  if (expired || alreadyDownloaded) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {alreadyDownloaded ? "Already Accessed" : "Transfer Expired"}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {alreadyDownloaded
              ? "This transfer was set to view-once and has already been accessed."
              : "This transfer link has expired and is no longer available."}
          </p>
          <div className="mt-6">
            <BrandLogo size="sm" />
          </div>
        </div>
      </main>
    );
  }

  const initials = agent.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/60 via-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur border-b border-blue-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center justify-between">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            Encrypted Transfer
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10 space-y-5">
        {/* Sender card */}
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            {agent.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agent.photoUrl} alt={agent.displayName} className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-100" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm ring-2 ring-blue-100">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{agent.displayName}</p>
              {agent.company && <p className="text-xs text-gray-500">{agent.company}</p>}
            </div>
          </div>

          <h1 className="text-lg font-bold text-gray-900 mb-1">
            {title || `${files.length} file${files.length !== 1 ? "s" : ""} for you`}
          </h1>
          {message && <p className="text-sm text-gray-600 leading-relaxed">{message}</p>}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <FolderUp className="w-3.5 h-3.5" />
              {files.length} file{files.length !== 1 ? "s" : ""} · {fmtBytes(totalBytes)}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` : "Expires today"}
            </span>
            {viewOnce && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <Eye className="w-3.5 h-3.5" />
                View once
              </span>
            )}
          </div>
        </div>

        {/* Files */}
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Files</p>
            {files.length > 1 && (
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download all
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.fileName}</p>
                  <p className="text-xs text-gray-400">{fmtBytes(f.sizeBytes)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(f.id, f.fileName)}
                  disabled={downloading === f.id}
                  className="shrink-0 gap-1.5"
                >
                  {downloading === f.id ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {downloading === f.id ? "Done" : "Download"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-gray-400">
            Files available until {fmtDate(expiresAt)}
          </p>
          <div className="mt-3">
            <BrandLogo size="sm" />
          </div>
        </div>
      </div>
    </main>
  );
}
