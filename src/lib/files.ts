/**
 * Encrypted file storage for ID uploads.
 *
 * Files are encrypted with AES-256-GCM using the same master key as field encryption.
 * Stored at: uploads/<randomId>.enc
 * DB stores only the filename, not the full path.
 *
 * Format on disk: [12-byte IV][16-byte authTag][ciphertext...]
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { customAlphabet } from "nanoid";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const uploadsDir = join(process.cwd(), "uploads");

const fileId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 32);

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set.");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes.");
  return buf;
}

/**
 * Encrypt a buffer and write it to disk.
 * Returns the filename (not full path).
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
  await writeFile(join(uploadsDir, filename), fileContent);
  return filename;
}

/**
 * Read an encrypted file from disk and decrypt it.
 * Returns the plaintext buffer.
 */
export async function readAndDecryptFile(filename: string): Promise<Buffer> {
  // Sanitize: only allow [a-z0-9].enc filenames to prevent path traversal
  if (!/^[a-z0-9]{32}\.enc$/.test(filename)) {
    throw new Error("Invalid filename.");
  }

  const key = getMasterKey();
  const fileContent = await readFile(join(uploadsDir, filename));

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
 * Delete an encrypted file from disk. Silently ignores missing files.
 */
export async function deleteFile(filename: string): Promise<void> {
  if (!/^[a-z0-9]{32}\.enc$/.test(filename)) return;
  try {
    await unlink(join(uploadsDir, filename));
  } catch {
    // ignore
  }
}
