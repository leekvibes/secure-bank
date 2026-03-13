import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { del } from "@vercel/blob";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  const transfer = await db.fileTransfer.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: { files: true },
  });

  if (!transfer) return apiError(404, "NOT_FOUND", "Transfer not found.");

  // Delete blobs from Vercel
  await Promise.allSettled(transfer.files.map((f) => del(f.blobUrl)));

  await db.fileTransfer.delete({ where: { id: params.id } });

  return apiSuccess({ success: true });
}
