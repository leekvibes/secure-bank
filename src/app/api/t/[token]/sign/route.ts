import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { signTransferAccess } from "@/lib/transfer-signing";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`transfer:sign:${params.token}:${ip}`);
  if (!rl.allowed) return apiError(429, "RATE_LIMITED", "Too many requests.");

  const { searchParams } = req.nextUrl;
  const fileId = searchParams.get("fileId");
  const action = searchParams.get("action");

  if (!fileId) return apiError(400, "MISSING_FILE_ID", "fileId is required.");
  if (action !== "preview" && action !== "download") return apiError(400, "INVALID_ACTION", "action must be preview or download.");

  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    select: {
      id: true,
      expiresAt: true,
      status: true,
      viewOnce: true,
      files: { where: { id: fileId }, select: { id: true } },
    },
  });

  if (!transfer) return apiError(404, "NOT_FOUND", "Transfer not found.");
  if (transfer.expiresAt < new Date() || transfer.status === "EXPIRED") {
    return apiError(410, "EXPIRED", "This transfer has expired.");
  }
  if (transfer.viewOnce && transfer.status === "DOWNLOADED") {
    return apiError(410, "ALREADY_ACCESSED", "This transfer has already been accessed.");
  }
  if (transfer.files.length === 0) return apiError(404, "FILE_NOT_FOUND", "File not found in this transfer.");

  const signedToken = signTransferAccess({ fileId, transferToken: params.token, action });
  const expiresAt = new Date(Date.now() + 600_000).toISOString();

  return apiSuccess({ signedToken, expiresAt });
}
