"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Camera, User, ArrowRight, ArrowLeft, Loader2, Shield, Lock, Check, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/info-tip";
import { OnboardingShell } from "../onboarding-shell";
import { PhotoCropUploader } from "@/components/photo-crop-uploader";

const MAX_LOGOS = 5;

export default function BrandingPage() {
  const router = useRouter();
  const [logos, setLogos] = useState<{ id: string; url: string }[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    if (file.size > 512 * 1024) {
      setError("File must be under 512 KB.");
      return;
    }
    if (logos.length >= MAX_LOGOS) {
      setError(`You can upload up to ${MAX_LOGOS} logos.`);
      return;
    }
    setUploadingLogo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/agent/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to upload logo.");
        setUploadingLogo(false);
        return;
      }

      const data = await res.json();
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setLogos((prev) => [...prev, { id: data.assetId, url: dataUri }]);
    } catch {
      setError("Failed to upload logo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function deleteLogo(id: string) {
    try {
      await fetch(`/api/agent/logo?id=${id}`, { method: "DELETE" });
      setLogos((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError("Failed to remove logo.");
    }
  }

  async function uploadPhoto(file: File) {
    if (file.size > 512 * 1024) {
      setError("File must be under 512 KB.");
      return;
    }
    setUploadingPhoto(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/agent/photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to upload photo.");
        setUploadingPhoto(false);
        return;
      }

      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPhoto(dataUri);
    } catch {
      setError("Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <OnboardingShell currentStep={3}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Add your branding</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your photo and logos build trust with clients. Here's how they'll appear on your secure requests.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white/80 backdrop-blur shadow-sm p-6">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Company Logos (up to {MAX_LOGOS})
                <InfoTip text="Your company logos appear at the top of every secure request your clients receive. You can upload multiple logos if you work with different brands or carriers." />
              </p>

              {logos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {logos.map((logo) => (
                    <div key={logo.id} className="relative group rounded-xl border border-border bg-muted/30 p-2 flex items-center justify-center h-16">
                      <Image src={logo.url} alt="Logo" width={80} height={60} className="max-h-12 object-contain rounded-lg" />
                      <button
                        type="button"
                        onClick={() => deleteLogo(logo.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {logos.length < MAX_LOGOS && (
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadingLogo}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 bg-muted/30"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {logos.length === 0 ? "Click to upload" : "Add another logo"}
                      </span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  if (e.target) e.target.value = "";
                }}
              />
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP, or SVG. Max 512 KB each.</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                Your Profile Photo
                <InfoTip text="Drag to center your face after uploading. Clients see your photo on secure request pages." />
              </p>
              <PhotoCropUploader
                currentPhotoUrl={photo}
                disabled={uploadingPhoto}
                onSave={(url) => setPhoto(url)}
                onDelete={async () => {
                  await fetch("/api/agent/photo", { method: "DELETE" });
                  setPhoto(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <p className="text-xs font-medium text-muted-foreground">Preview: What your clients will see</p>
            <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-5">
              <div className="flex items-center gap-3 mb-3">
                {photo ? (
                  <Image src={photo} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {logos.slice(0, 3).map((logo) => (
                      <Image key={logo.id} src={logo.url} alt="" width={20} height={20} className="h-5 w-auto object-contain" />
                    ))}
                    <p className="text-sm font-semibold text-foreground">Your Name</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">has requested your information securely</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-primary" />
                  End-to-end encrypted
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  Verified sender
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-primary" />
                  Secure Link
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/onboarding/trust")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={() => router.push("/onboarding/plan")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
            <Button
              onClick={() => router.push("/onboarding/plan")}
              className="h-10 px-6 rounded-xl font-medium"
            >
              <span className="flex items-center gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
