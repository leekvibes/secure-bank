const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

export interface UploadValidationResult {
  ok: boolean;
  error?: string;
}

export function validateUploadFile(file: File): UploadValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, error: "File is required." };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, error: "File exceeds 5MB limit." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeAllowed = ALLOWED_MIME_TYPES.has(file.type);
  const extAllowed = ALLOWED_EXTENSIONS.has(extension);

  if (!mimeAllowed || !extAllowed) {
    return { ok: false, error: "Only JPG and PNG files are allowed." };
  }

  return { ok: true };
}

/**
 * Placeholder hook for AV scan integration (ClamAV / third-party scanner).
 * Return false to block uploads that fail scanning.
 */
export async function runVirusScanPlaceholder(_file: File): Promise<boolean> {
  return true;
}

export const UPLOAD_SECURITY = {
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_MIME_TYPES: Array.from(ALLOWED_MIME_TYPES),
  ALLOWED_EXTENSIONS: Array.from(ALLOWED_EXTENSIONS),
} as const;

