"use client";

import { useState, useRef } from "react";
import { Camera, X, Check, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CROP_SIZE = 260;

interface Props {
  currentPhotoUrl: string | null;
  onSave: (url: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function PhotoCropUploader({ currentPhotoUrl, onSave, onDelete, disabled }: Props) {
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB."); return; }
    setError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const reader = new FileReader();
    reader.onload = (ev) => setRawSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function startDrag(clientX: number, clientY: number) {
    setDragging(true);
    setDragStart({ x: clientX, y: clientY, ox: offset.x, oy: offset.y });
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragging) return;
    setOffset({ x: dragStart.ox + (clientX - dragStart.x), y: dragStart.oy + (clientY - dragStart.y) });
  }

  async function handleCropAndSave() {
    if (!imgRef.current || !rawSrc) return;
    setUploading(true);
    setError(null);

    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d")!;

    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const img = imgRef.current;
    const drawW = img.naturalWidth * zoom;
    const drawH = img.naturalHeight * zoom;
    const drawX = (CROP_SIZE - drawW) / 2 + offset.x;
    const drawY = (CROP_SIZE - drawH) / 2 + offset.y;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob(async (blob) => {
      if (!blob) { setUploading(false); setError("Crop failed. Please try again."); return; }
      const fd = new FormData();
      fd.append("photo", blob, "photo.jpg");
      const res = await fetch("/api/agent/photo", { method: "POST", body: fd });
      const data = await res.json();
      setUploading(false);
      if (!res.ok) { setError(data.error ?? "Upload failed."); return; }
      onSave(data.photoUrl);
      setRawSrc(null);
    }, "image/jpeg", 0.92);
  }

  function cancel() {
    setRawSrc(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {rawSrc ? (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Position your photo</p>
            <p className="text-xs text-muted-foreground">Drag to center your face · Use slider to zoom</p>
          </div>

          <div
            className="relative mx-auto overflow-hidden cursor-move select-none ring-4 ring-primary/20 shadow-xl"
            style={{ width: CROP_SIZE, height: CROP_SIZE, borderRadius: "50%" }}
            onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
            onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }}
            onTouchEnd={() => setDragging(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={rawSrc}
              alt="Crop preview"
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                transformOrigin: "center",
                maxWidth: "none",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>

          <div className="flex items-center gap-3 max-w-[260px] mx-auto">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-primary"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          <div className="flex gap-2 max-w-[260px] mx-auto">
            <Button variant="outline" size="sm" onClick={cancel} className="flex-1 rounded-xl" disabled={uploading}>
              <X className="w-3.5 h-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleCropAndSave} disabled={uploading} className="flex-1 rounded-xl">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {uploading ? "Saving..." : "Save Photo"}
            </Button>
          </div>
        </div>
      ) : currentPhotoUrl ? (
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhotoUrl}
            alt="Profile photo"
            className="w-32 h-32 object-cover rounded-full border-2 border-border/40 ring-4 ring-primary/8 shrink-0"
          />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drag to reposition and zoom when replacing your photo.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="rounded-xl"
              >
                <Camera className="w-3.5 h-3.5" />
                Replace &amp; crop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                disabled={disabled}
                className="rounded-xl text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-3 bg-muted/20 group"
        >
          <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center group-hover:bg-primary/14 transition-colors">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Upload profile photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP · Max 5 MB</p>
          </div>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
