import { customAlphabet } from "nanoid";

const alpha = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

/** Generate a unique SL-XXXX-XXXX-XXXX signature attribution ID */
export function generateSignatureId(): string {
  return `SL-${alpha()}-${alpha()}-${alpha()}`;
}
