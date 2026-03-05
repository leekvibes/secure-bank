export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidSsnFormat(value: string): boolean {
  return /^\d{3}-?\d{2}-?\d{4}$/.test(value);
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

export function fieldsMatch(a: string, b: string, digitsOnly = false): boolean {
  if (digitsOnly) {
    return normalizeDigits(a) === normalizeDigits(b);
  }
  return a === b;
}

