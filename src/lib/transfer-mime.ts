export const PREVIEW_IMAGE_MIMES = new Set(["image/jpeg","image/jpg","image/png","image/webp","image/gif","image/svg+xml"]);
export const PREVIEW_VIDEO_MIMES = new Set(["video/mp4","video/webm","video/ogg","video/quicktime","video/x-m4v"]);
export const PREVIEW_AUDIO_MIMES = new Set(["audio/mpeg","audio/mp3","audio/wav","audio/ogg","audio/m4a","audio/x-m4a","audio/aac"]);
export const PREVIEW_PDF_MIMES   = new Set(["application/pdf"]);
export const PREVIEW_TEXT_MIMES  = new Set(["text/plain","text/csv","application/json","text/html","text/markdown"]);

export type MimeCategory = "image" | "video" | "audio" | "pdf" | "text" | "archive" | "document" | "generic";

export function mimeCategory(mimeType: string): MimeCategory {
  const m = mimeType.toLowerCase().split(";")[0].trim();
  if (PREVIEW_IMAGE_MIMES.has(m)) return "image";
  if (PREVIEW_VIDEO_MIMES.has(m)) return "video";
  if (PREVIEW_AUDIO_MIMES.has(m)) return "audio";
  if (PREVIEW_PDF_MIMES.has(m))   return "pdf";
  if (PREVIEW_TEXT_MIMES.has(m))  return "text";
  if (m === "application/zip" || m === "application/x-zip-compressed") return "archive";
  if (m.includes("word") || m.includes("spreadsheet") || m.includes("presentation")) return "document";
  return "generic";
}

export function isPreviewable(mimeType: string): boolean {
  const cat = mimeCategory(mimeType);
  return ["image","video","audio","pdf","text"].includes(cat);
}

// Returns "inline" for previews and media downloads (better mobile behavior);
// documents/archives/default still download as attachments.
export function dispositionFor(action: "preview" | "download", mimeType: string): "inline" | "attachment" {
  const cat = mimeCategory(mimeType);
  if (action === "preview") return isPreviewable(mimeType) ? "inline" : "attachment";
  return cat === "image" || cat === "video" ? "inline" : "attachment";
}

// 50 MB threshold: proxy below, redirect CDN above (for preview streaming)
export const PROXY_PREVIEW_THRESHOLD = 50 * 1024 * 1024;
