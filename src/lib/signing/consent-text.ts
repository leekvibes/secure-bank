export const CONSENT_TEXT_V1 = `By proceeding, you agree to sign this document electronically. Your electronic signature has the same legal force and effect as a handwritten signature under the Electronic Signatures in Global and National Commerce Act (ESIGN Act, 15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).

RIGHT TO PAPER COPY: You have the right to receive this document and any disclosures in paper form. To request a paper copy, contact the sender directly.

WITHDRAWING CONSENT: You may decline to sign by clicking "Decline to Sign" at any time before completing your signature. Once signed, contact the sender to request corrections or amendments.

SYSTEM REQUIREMENTS: A modern web browser with JavaScript enabled and the ability to open and save PDF files.

AUDIT RECORD: Your IP address, browser information, and the exact timestamps of consent and signing will be permanently recorded as part of the legally binding audit trail for this document.`;

export const CURRENT_CONSENT_VERSION = "v1";

export const CONSENT_TEXTS: Record<string, string> = {
  v1: CONSENT_TEXT_V1,
};
