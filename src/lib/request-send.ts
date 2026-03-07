export type RequestSendMethod = "EMAIL" | "COPY";

export function getInitialSendMethod(input: {
  clientEmail?: string | null;
}): RequestSendMethod {
  const hasEmail = Boolean(input.clientEmail?.trim());

  if (hasEmail) return "EMAIL";
  return "COPY";
}
