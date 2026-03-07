export type RequestSendMethod = "SMS" | "EMAIL" | "COPY";

export function getInitialSendMethod(input: {
  twilioEnabled: boolean;
  clientPhone?: string | null;
  clientEmail?: string | null;
}): RequestSendMethod {
  const hasEmail = Boolean(input.clientEmail?.trim());

  if (hasEmail) return "EMAIL";
  return "COPY";
}
