/**
 * Field-level encryption using AES-256-GCM.
 *
 * Each field is independently encrypted with a random IV.
 * Stored format: base64(iv):base64(authTag):base64(ciphertext)
 *
 * The master key comes from ENCRYPTION_KEY env var (32 bytes, hex-encoded).
 * Never log plaintext. Never store plaintext in the database.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set.");
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte (64 hex char) value.");
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decrypt(ciphertext: string): string {
  const key = getMasterKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format.");
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypt a record of field->plaintext values.
 * Returns field->ciphertext record.
 */
export function encryptFields(
  fields: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = encrypt(value);
    }
  }
  return result;
}

/**
 * Decrypt a record of field->ciphertext values.
 * Returns field->plaintext record.
 */
export function decryptFields(
  fields: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decrypt(value);
  }
  return result;
}

/**
 * Mask a value for display (e.g. "****1234").
 */
export function maskValue(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return "****";
  return "****" + value.slice(-visibleChars);
}

/**
 * Generate a random 64-hex-char key suitable for ENCRYPTION_KEY.
 * Only use this for key generation tooling, not in app code paths.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
