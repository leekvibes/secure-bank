import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import { authOptions } from "@/lib/auth/options";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAllowedTransferBlobUrl } from "@/lib/transfer-blob";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  const body = (await req.json().catch(() => null)) as { blobUrls?: string[] } | null;
  const blobUrls = Array.isArray(body?.blobUrls) ? body!.blobUrls : [];
  if (blobUrls.length === 0) {
    return apiError(400, "NO_BLOBS", "No blob URLs provided.");
  }

  const safeUrls = blobUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && isAllowedTransferBlobUrl(u))
    .slice(0, 100);

  if (safeUrls.length === 0) {
    return apiError(400, "INVALID_BLOB_URLS", "No valid blob URLs provided.");
  }

  await Promise.allSettled(safeUrls.map((url) => del(url)));
  return apiSuccess({ deleted: safeUrls.length });
}
