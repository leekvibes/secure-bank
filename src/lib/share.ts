export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = "shared" | "copied";

export async function shareLink(payload: SharePayload): Promise<ShareResult> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  const shareData: ShareData = {
    title: payload.title,
    text: payload.text,
    url: payload.url,
  };

  if (typeof nav.share === "function") {
    const canShare = typeof nav.canShare === "function" ? nav.canShare(shareData) : true;
    if (canShare) {
      await nav.share(shareData);
      return "shared";
    }
  }

  await navigator.clipboard.writeText(`${payload.text}\n\n${payload.url}`);
  return "copied";
}

