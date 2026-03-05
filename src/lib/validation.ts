export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidSsnFormat(value: string): boolean {
  return /^\d{3}-?\d{2}-?\d{4}$/.test(value.trim());
}

/**
 * ABA routing checksum validation.
 * https://www.aba.com/news-research/analysis-guides/routing-number-policy-procedures
 */
export function isValidRoutingNumberChecksum(value: string): boolean {
  const digits = normalizeDigits(value);
  if (!/^\d{9}$/.test(digits)) return false;

  const nums = digits.split("").map((d) => Number(d));
  const checksum =
    3 * (nums[0] + nums[3] + nums[6]) +
    7 * (nums[1] + nums[4] + nums[7]) +
    (nums[2] + nums[5] + nums[8]);

  return checksum % 10 === 0;
}

export function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;
  const digits = normalizeDigits(trimmed);
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidBankAccountNumber(value: string): boolean {
  const digits = normalizeDigits(value);
  return /^\d{4,34}$/.test(digits);
}

export function isValidSingleUseToken(
  expiresAt: Date | string,
  status: string,
  hasExistingSubmission: boolean
): { ok: true } | { ok: false; code: "expired" | "already_used"; message: string } {
  if (new Date(expiresAt) < new Date() || status === "EXPIRED") {
    return { ok: false, code: "expired", message: "This link has expired." };
  }
  if (status === "SUBMITTED" || hasExistingSubmission) {
    return {
      ok: false,
      code: "already_used",
      message: "This link has already been submitted.",
    };
  }
  return { ok: true };
}

export function fieldsMatch(a: string, b: string, digitsOnly = false): boolean {
  if (digitsOnly) {
    return normalizeDigits(a) === normalizeDigits(b);
  }
  return a === b;
}
