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
        <div className="h-16 bg-surface-2 rounded-xl border border-border/40 animate-pulse" />
      ) : (
        <>
          {assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border/40 rounded-xl text-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No logos uploaded yet.</p>
              <Link
                href="/dashboard/settings"
                target="_blank"
                className="text-xs text-primary hover:underline flex items-center gap-1"
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
                    className={`relative w-20 h-14 rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selected
                        ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                        : "border-border/40 bg-card hover:border-border"
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
                      <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                    )}
                    {selected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}

              <label className="relative w-20 h-14 rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Add</span>
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
            <p className="text-xs text-red-500">{uploadError}</p>
          )}

          {assets.length > 0 && (
            <div className="border border-border/40 rounded-xl overflow-hidden">
              <div className="bg-surface-2 px-3 py-1.5 flex items-center justify-between border-b border-border/40">
                <span className="text-xs text-muted-foreground font-medium">Header preview</span>
                {selectedIds.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No logos selected — default</span>
                )}
              </div>
              <div className="bg-card px-4 py-3">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
                      <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-2 border border-border/40 rounded-lg px-2 py-1">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[8px] font-bold shrink-0">
                      {(agentName ?? "A")[0]}
                    </div>
                    <span className="text-xs text-foreground truncate max-w-[80px]">
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
