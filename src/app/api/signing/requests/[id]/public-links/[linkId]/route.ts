import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

// PATCH /api/signing/requests/[id]/public-links/[linkId]
// Toggle active, update label / maxUses / requireName / requireEmail / expiresAt
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; linkId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const link = await db.docSignPublicLink.findUnique({
    where: { id: params.linkId },
    select: { agentId: true, requestId: true },
  });
  if (!link) return apiError(404, "NOT_FOUND", "Public link not found.");
  if (link.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (link.requestId !== params.id) return apiError(400, "MISMATCH", "Link does not belong to this request.");

  let body: {
    isActive?: boolean;
    label?: string | null;
    maxUses?: number | null;
    requireName?: boolean;
    requireEmail?: boolean;
    expiresAt?: string | null;
  } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const data: Record<string, unknown> = {};
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if ("label" in body) data.label = body.label?.trim() || null;
  if ("maxUses" in body) data.maxUses = body.maxUses != null ? Math.max(1, Math.floor(body.maxUses)) : null;
  if (body.requireName !== undefined) data.requireName = body.requireName;
  if (body.requireEmail !== undefined) data.requireEmail = body.requireEmail;
  if ("expiresAt" in body) {
    data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  }

  const updated = await db.docSignPublicLink.update({ where: { id: params.linkId }, data });
  return apiSuccess({ link: updated });
}

// DELETE /api/signing/requests/[id]/public-links/[linkId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; linkId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const link = await db.docSignPublicLink.findUnique({
    where: { id: params.linkId },
    select: { agentId: true, requestId: true, slotRecipientId: true },
  });
  if (!link) return apiError(404, "NOT_FOUND", "Public link not found.");
  if (link.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (link.requestId !== params.id) return apiError(400, "MISMATCH", "Link does not belong to this request.");

  // Check if this was the only public link for this request
  const remaining = await db.docSignPublicLink.count({
    where: { requestId: params.id, id: { not: params.linkId } },
  });

  await db.$transaction(async (tx) => {
    await tx.docSignPublicLink.delete({ where: { id: params.linkId } });
    // If no other public links exist, un-mark the slot recipient
    if (remaining === 0) {
      await tx.docSignRecipient.update({
        where: { id: link.slotRecipientId },
        data: { isPublicSlot: false },
      });
    }
  });

  return apiSuccess({ deleted: true });
}
