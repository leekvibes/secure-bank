export function getErrorMessage(
  payload: unknown,
  fallback = "Something went wrong."
): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    const maybeError = (payload as { error?: unknown }).error;
    if (maybeError !== undefined) {
      return getErrorMessage(maybeError, fallback);
    }
  }

  return fallback;
}

export function getFieldErrors(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== "object") return {};

  const directFieldErrors = (payload as { fieldErrors?: unknown }).fieldErrors;
  if (
    directFieldErrors &&
    typeof directFieldErrors === "object" &&
    !Array.isArray(directFieldErrors)
  ) {
    return Object.fromEntries(
      Object.entries(directFieldErrors).map(([key, value]) => [
        key,
        typeof value === "string" ? value : "",
      ])
    );
  }

  const detailsFieldErrors = (
    payload as { error?: { details?: { fieldErrors?: unknown } } }
  ).error?.details?.fieldErrors;
  if (
    detailsFieldErrors &&
    typeof detailsFieldErrors === "object" &&
    !Array.isArray(detailsFieldErrors)
  ) {
    return Object.fromEntries(
      Object.entries(detailsFieldErrors).map(([key, value]) => [
        key,
        typeof value === "string" ? value : "",
      ])
    );
  }

  return {};
}
