import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isDeclineReasonCode } from "@/lib/signing/decline-reasons";

// GET /api/signing/requests/[id] — full detail for agent dashboard
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      include: {
        recipients: {
          orderBy: { order: "asc" },
          include: {
            fields: { orderBy: { page: "asc" } },
          },
        },
        pages: { orderBy: { page: "asc" } },
        signingFields: { orderBy: [{ page: "asc" }, { y: "asc" }] },
        auditLogs: { orderBy: { createdAt: "asc" } },
        certificate: true,
      },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

    // Computed display status
    const now = new Date();
    let displayStatus = request.status;
    if ((request.status === "SENT" || request.status === "OPENED") && request.expiresAt < now) {
      displayStatus = "EXPIRED";
    }
    const completedCount = request.recipients.filter((r) => r.status === "COMPLETED").length;
    if ((request.status === "SENT" || request.status === "OPENED") && completedCount > 0 && completedCount < request.recipients.length) {
      displayStatus = "PARTIALLY_SIGNED";
    }

    // Editable: DRAFT always; SENT/OPENED only if no recipient has signed yet
    const isEditable =
      request.status === "DRAFT" ||
      ((request.status === "SENT" || request.status === "OPENED") && completedCount === 0);

    const declineMetaByRecipient = new Map<string, { reasonCode: string | null; reasonText: string | null }>();
    for (const log of request.auditLogs) {
      if (log.event !== "DECLINED" || !log.recipientId || !log.metadata) continue;
      try {
        const parsed = JSON.parse(log.metadata) as { reasonCode?: string; reasonText?: string; reason?: string };
        const rawCode = parsed.reasonCode;
        const reasonCode = rawCode && isDeclineReasonCode(rawCode) ? rawCode : null;
        const reasonText = (parsed.reasonText ?? parsed.reason ?? "").trim() || null;
        declineMetaByRecipient.set(log.recipientId, { reasonCode, reasonText });
      } catch {
        // Ignore malformed metadata; UI falls back to recipient.declineReason.
      }
    }

    const recipients = request.recipients.map((recipient) => {
      const declineMeta = declineMetaByRecipient.get(recipient.id);
      return {
        ...recipient,
        declineReasonCode: declineMeta?.reasonCode ?? (recipient.declineReason ? "OTHER" : null),
        declineReasonText: declineMeta?.reasonText ?? recipient.declineReason ?? null,
      };
    });

    return apiSuccess({
      request: {
        ...request,
        recipients,
        displayStatus,
        completedRecipients: completedCount,
        isEditable,
      },
    });
  } catch (err) {
    console.error("[signing/requests/get]", err);
    return apiError(500, "SERVER_ERROR", "Failed to load signing request.");
  }
}

// DELETE /api/signing/requests/[id] — soft delete (or hard delete if already soft-deleted)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      select: { id: true, agentId: true, status: true, expiresAt: true, deletedAt: true },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

    // If already soft-deleted → hard delete permanently
    if (request.deletedAt) {
      await db.docSignRequest.delete({ where: { id: params.id } });
      return apiSuccess({ deleted: true });
    }

    // Soft delete: set deletedAt = now
    const now = new Date();
    await db.docSignRequest.update({
      where: { id: params.id },
      data: { deletedAt: now },
    });
    return apiSuccess({ deletedAt: now.toISOString() });
  } catch (err) {
    console.error("[signing/requests/delete]", err);
    return apiError(500, "SERVER_ERROR", "Failed to delete signing request.");
  }
}

// PATCH /api/signing/requests/[id] — restore a soft-deleted request
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const body = await req.json().catch(() => ({}));
  if (body.action !== "restore") return apiError(400, "BAD_REQUEST", "Unknown action.");

  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true, deletedAt: true },
  });

  if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (!request.deletedAt) return apiError(409, "CONFLICT", "Request is not deleted.");

  await db.docSignRequest.update({
    where: { id: params.id },
    data: { deletedAt: null },
  });

  return apiSuccess({ restored: true });
}
