export function isAllowedTransferBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "vercel-storage.com" || host.endsWith(".vercel-storage.com");
  } catch {
    return false;
  }
}

