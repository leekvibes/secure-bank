export const DECLINE_REASON_CODES = [
  "WRONG_DOCUMENT",
  "NEED_ATTORNEY_REVIEW",
  "PRICE_OR_TERMS_CHANGED",
  "NOT_READY_TO_SIGN",
  "MISSING_INFORMATION",
  "NO_LONGER_INTERESTED",
  "NO_REASON_GIVEN",
  "OTHER",
] as const;

export type DeclineReasonCode = (typeof DECLINE_REASON_CODES)[number];

export const DECLINE_REASON_LABELS: Record<DeclineReasonCode, string> = {
  WRONG_DOCUMENT: "Wrong document",
  NEED_ATTORNEY_REVIEW: "Need to review with attorney",
  PRICE_OR_TERMS_CHANGED: "Price or terms changed",
  NOT_READY_TO_SIGN: "Not ready to sign",
  MISSING_INFORMATION: "Missing information",
  NO_LONGER_INTERESTED: "No longer interested",
  NO_REASON_GIVEN: "Prefer not to provide a reason",
  OTHER: "Other",
};

export const DECLINE_REASON_OPTIONS = DECLINE_REASON_CODES.map((code) => ({
  code,
  label: DECLINE_REASON_LABELS[code],
}));

export function isDeclineReasonCode(value: string): value is DeclineReasonCode {
  return (DECLINE_REASON_CODES as readonly string[]).includes(value);
}
