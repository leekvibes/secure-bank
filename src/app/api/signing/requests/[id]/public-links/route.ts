import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateToken } from "@/lib/tokens";

// GET /api/signing/requests/[id]/public-links
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    select: { agentId: true },
  });
  if (!request) return apiError(404, "NOT_FOUND", "Request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

  const links = await db.docSignPublicLink.findMany({
    where: { requestId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      usages: {
        select: {
          id: true,
          createdAt: true,
          recipient: { select: { name: true, email: true, status: true, completedAt: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return apiSuccess({ links });
}

// POST /api/signing/requests/[id]/public-links
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    include: {
      recipients: { include: { fields: { select: { id: true } } }, orderBy: { order: "asc" } },
    },
  });
  if (!request) return apiError(404, "NOT_FOUND", "Request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (request.status === "VOIDED") return apiError(400, "VOIDED", "Cannot create public link for a voided request.");
  if (request.status === "COMPLETED") return apiError(400, "COMPLETED", "Cannot create public link for a completed request.");

  // Must have at least one recipient with fields
  const recipientsWithFields = request.recipients.filter((r) => r.fields.length > 0 && !r.isPublicSlot);
  if (recipientsWithFields.length === 0) {
    return apiError(400, "NO_FIELDS", "Place signing fields on the document before creating a public link.");
  }

  let body: {
    label?: string;
    maxUses?: number | null;
    requireName?: boolean;
    requireEmail?: boolean;
    expiresAt?: string | null;
    slotRecipientId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body ok
  }

  // Determine which recipient is the public slot
  let slotRecipientId = body.slotRecipientId;
  if (slotRecipientId) {
    const slot = recipientsWithFields.find((r) => r.id === slotRecipientId);
    if (!slot) return apiError(400, "INVALID_SLOT", "Slot recipient not found or has no fields.");
  } else {
    // Auto-pick: first recipient with fields
    slotRecipientId = recipientsWithFields[0].id;
  }

  const maxUses = body.maxUses != null ? Math.max(1, Math.floor(body.maxUses)) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return apiError(400, "INVALID_DATE", "Invalid expiry date.");

  const token = generateToken();

  const [link] = await db.$transaction([
    db.docSignPublicLink.create({
      data: {
        agentId: session.user.id,
        requestId: params.id,
        slotRecipientId,
        token,
        label: body.label?.trim() || null,
        maxUses,
        requireName: body.requireName !== false,
        requireEmail: body.requireEmail === true,
        isActive: true,
        expiresAt,
      },
    }),
    db.docSignRecipient.update({
      where: { id: slotRecipientId },
      data: { isPublicSlot: true },
    }),
  ]);

  await db.docSignAuditLog.create({
    data: {
      requestId: params.id,
      event: "PUBLIC_LINK_CREATED",
      metadata: JSON.stringify({ linkId: link.id, label: link.label, token: link.token }),
    },
  });

  return apiSuccess({ link }, 201);
}
