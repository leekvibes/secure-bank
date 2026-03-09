/**
 * Encrypted file storage for ID uploads.
 *
 * Files are encrypted with AES-256-GCM before upload.
 * Stored in Vercel Blob (production) with local disk fallback for legacy files.
 *
 * DB stores the full Vercel Blob URL (new) or legacy filename (old).
 * Format on blob: [12-byte IV][16-byte authTag][ciphertext...]
 */

import { put, del } from "@vercel/blob";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { customAlphabet } from "nanoid";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const fileId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 32);

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set.");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes.");
  return buf;
}

/**
 * Encrypt a buffer and upload it to Vercel Blob.
 * Returns the blob URL (stored in DB).
 */
export async function encryptAndSaveFile(data: Buffer): Promise<string> {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Layout: [IV (12)] [authTag (16)] [ciphertext]
  const fileContent = Buffer.concat([iv, authTag, encrypted]);
  const filename = `${fileId()}.enc`;

  const blob = await put(`uploads/${filename}`, fileContent, {
    access: "public", // content is AES-256 encrypted — URL alone is useless
    contentType: "application/octet-stream",
  });

  return blob.url;
}

/**
 * Fetch and decrypt a file.
 * Handles both new Vercel Blob URLs and legacy local filenames.
 */
export async function readAndDecryptFile(filePath: string): Promise<Buffer> {
  let fileContent: Buffer;

  if (filePath.startsWith("https://")) {
    // Vercel Blob URL
    const res = await fetch(filePath, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch file from storage.");
    fileContent = Buffer.from(await res.arrayBuffer());
  } else {
    // Legacy: local disk file (development only)
    if (!/^[a-z0-9]{32}\.enc$/.test(filePath)) {
      throw new Error("Invalid filename.");
    }
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    fileContent = await readFile(join(process.cwd(), "uploads", filePath));
  }

  const key = getMasterKey();
  const iv = fileContent.slice(0, IV_LENGTH);
  const authTag = fileContent.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = fileContent.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Delete a file from Vercel Blob (or ignore legacy local files in prod).
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (filePath.startsWith("https://")) {
    try {
      await del(filePath);
    } catch {
      // ignore
    }
  } else {
    // Legacy local file — only attempt on non-serverless environments
    if (!/^[a-z0-9]{32}\.enc$/.test(filePath)) return;
    try {
      const { unlink } = await import("fs/promises");
      const { join } = await import("path");
      await unlink(join(process.cwd(), "uploads", filePath));
    } catch {
      // ignore
    }
  }
}
