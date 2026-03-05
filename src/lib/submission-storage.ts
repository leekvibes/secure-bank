import { encryptFields } from "@/lib/crypto";

const SENSITIVE_FIELD_KEYS = new Set(["ssn", "routingNumber", "accountNumber"]);

function isEncryptedValue(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function buildEncryptedSubmissionData(
  validated: Record<string, string | boolean>
): string {
  const cleartextFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(validated)) {
    if (key === "consent" || key.startsWith("confirm")) continue;
    if (typeof value === "string" && value.trim() !== "") {
      cleartextFields[key] = value;
    }
  }

  const encryptedFields = encryptFields(cleartextFields);

  for (const [key, value] of Object.entries(cleartextFields)) {
    if (!SENSITIVE_FIELD_KEYS.has(key)) continue;
    const encrypted = encryptedFields[key];
    if (!encrypted || encrypted === value || !isEncryptedValue(encrypted)) {
      throw new Error(`Sensitive field '${key}' was not encrypted safely.`);
    }
  }

  return JSON.stringify(encryptedFields);
}

