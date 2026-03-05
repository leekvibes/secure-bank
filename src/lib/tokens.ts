import { customAlphabet } from "nanoid";

// URL-safe alphabet, no ambiguous chars (0/O, 1/l/I)
const alphabet =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

const nanoid = customAlphabet(alphabet, 32);

/**
 * Generate a cryptographically random, URL-safe token.
 * 32 chars from a 55-char alphabet = ~187 bits of entropy.
 * Unguessable and non-enumerable.
 */
export function generateToken(): string {
  return nanoid();
}

/**
 * Generate a URL-safe agent slug from a display name.
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = customAlphabet("0123456789abcdef", 6)();
  return `${base}-${suffix}`;
}
