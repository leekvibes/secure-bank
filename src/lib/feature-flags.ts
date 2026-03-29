function envEnabled(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

export function isDocumentTemplatesEnabledServer() {
  return envEnabled(process.env.DOCUMENT_TEMPLATES_V1, true);
}

export function isDocumentTemplatesEnabledClient() {
  return envEnabled(process.env.NEXT_PUBLIC_DOCUMENT_TEMPLATES_V1, true);
}

