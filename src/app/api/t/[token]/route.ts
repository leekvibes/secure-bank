import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    include: {
      files: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, downloadCount: true } },
      agent: { select: { displayName: true, agencyName: true, company: true, photoUrl: true } },
    },
  });

  if (!transfer) return apiError(404, "NOT_FOUND", "Transfer not found.");

  // Check expiry
  if (transfer.expiresAt < new Date() || transfer.status === "EXPIRED") {
    return apiError(410, "EXPIRED", "This transfer has expired.");
  }

  if (transfer.status === "DOWNLOADED" && transfer.viewOnce) {
    return apiError(410, "ALREADY_DOWNLOADED", "This transfer has already been accessed.");
  }

  // Mark as downloaded if view-once and first open
  if (transfer.viewOnce && transfer.status === "ACTIVE") {
    await db.fileTransfer.update({
      where: { id: transfer.id },
      data: { status: "DOWNLOADED" },
    });
  }

  return apiSuccess({
    id: transfer.id,
    title: transfer.title,
    message: transfer.message,
    viewOnce: transfer.viewOnce,
    expiresAt: transfer.expiresAt.toISOString(),
    files: transfer.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes.toString(),
      downloadCount: f.downloadCount,
    })),
    agent: {
      displayName: transfer.agent.displayName,
      company: transfer.agent.company ?? transfer.agent.agencyName,
      photoUrl: transfer.agent.photoUrl,
    },
  });
}
