import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// POST /api/sign/[token]/attachment
// Called from the signing ceremony when a signer uploads a file to an ATTACHMENT field.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: { select: { id: true, status: true, expiresAt: true } },
      fields: { select: { id: true, type: true } },
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (recipient.request.status === "VOIDED")
    return apiError(410, "VOIDED", "This document has been voided.");
  if (recipient.request.expiresAt < new Date())
    return apiError(410, "EXPIRED", "This signing link has expired.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already completed this signing.");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Expected multipart form data.");
  }

  const file = formData.get("file");
  const fieldId = String(formData.get("fieldId") ?? "").trim();

  if (!(file instanceof File)) return apiError(400, "NO_FILE", "No file provided.");
  if (!fieldId) return apiError(400, "NO_FIELD_ID", "fieldId is required.");

  // Validate field belongs to this recipient and is an ATTACHMENT type
  const field = recipient.fields.find((f) => f.id === fieldId);
  if (!field) return apiError(403, "FORBIDDEN", "Field does not belong to this recipient.");
  if (field.type !== "ATTACHMENT")
    return apiError(400, "WRONG_FIELD_TYPE", "Field is not an ATTACHMENT type.");

  if (file.size === 0) return apiError(400, "EMPTY_FILE", "File is empty.");
  if (file.size > MAX_SIZE_BYTES)
    return apiError(413, "FILE_TOO_LARGE", "File must be 20 MB or smaller.");
  if (!ALLOWED_TYPES.has(file.type))
    return apiError(415, "UNSUPPORTED_TYPE", "Unsupported file type. Upload images, PDFs, or Word documents.");

  // Sanitize filename and build blob path
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
  const blobPath = `signing/attachments/${recipient.request.id}/${recipient.id}/${fieldId}/${Date.now()}-${safeName}`;

  const blob = await put(blobPath, file.stream(), {
    access: "public",
    contentType: file.type,
  });

  return apiSuccess({
    url: blob.url,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}
