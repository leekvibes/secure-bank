"use client";

import { useEffect, useState } from "react";
import { Check, ImageIcon, Lock, Upload, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Asset {
  id: string;
  type: string;
  name: string | null;
  url: string | null;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Label shown on the preview header mockup */
  agentName?: string;
}

export function BrandingSelector({ selectedIds, onChange, agentName }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function fetchAssets() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/assets");
      const data = await res.json();
      setAssets(data.assets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAssets(); }, []);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "LOGO");
    fd.append("name", file.name.split(".")[0]);

    const res = await fetch("/api/agent/assets", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setUploadError(data.error ?? "Upload failed.");
      return;
    }

    await fetchAssets();
    if (data.asset?.id) onChange([...selectedIds, data.asset.id]);
  }

  const selectedAssets = assets.filter((a) => selectedIds.includes(a.id));

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="h-16 bg-slate-50 rounded-xl border border-slate-200 animate-pulse" />
      ) : (
        <>
          {/* Asset grid */}
          {assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
              <ImageIcon className="w-6 h-6 text-slate-300" />
              <p className="text-sm text-slate-500">No logos uploaded yet.</p>
              <Link
                href="/dashboard/settings"
                target="_blank"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Go to Settings to upload a logo
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assets.map((asset) => {
                const selected = selectedIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggle(asset.id)}
                    title={asset.name ?? "Logo"}
                    className={`relative w-20 h-14 rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {asset.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={asset.name ?? "Logo"}
                        className="max-h-10 max-w-[68px] object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                    )}
                    {selected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Upload new */}
              <label className="relative w-20 h-14 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-600">{uploadError}</p>
          )}

          {/* Mini header preview */}
          {assets.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs text-slate-400 font-medium">Header preview</span>
                {selectedIds.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No logos selected → default</span>
                )}
              </div>
              <div className="bg-white px-4 py-3">
                {/* 3-zone mini mockup */}
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Lock className="w-3 h-3" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 min-h-[28px]">
                    {selectedAssets.length > 0 ? (
                      selectedAssets.map((a, i) =>
                        a.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={a.url} alt="" className="h-5 object-contain max-w-[80px]" />
                        ) : null
                      )
                    ) : (
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[8px] font-bold shrink-0">
                      {(agentName ?? "A")[0]}
                    </div>
                    <span className="text-xs text-slate-600 truncate max-w-[80px]">
                      {agentName ?? "Agent Name"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
