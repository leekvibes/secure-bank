export type RequestSendMethod = "SMS" | "EMAIL" | "COPY";

export function getInitialSendMethod(input: {
  twilioEnabled: boolean;
  clientPhone?: string | null;
  clientEmail?: string | null;
}): RequestSendMethod {
  const hasPhone = Boolean(input.clientPhone?.trim());
  const hasEmail = Boolean(input.clientEmail?.trim());

  if (input.twilioEnabled && hasPhone) return "SMS";
  if (hasEmail) return "EMAIL";
  return "COPY";
}
