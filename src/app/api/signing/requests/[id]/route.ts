import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

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

    return apiSuccess({ request: { ...request, displayStatus, completedRecipients: completedCount, isEditable } });
  } catch (err) {
    console.error("[signing/requests/get]", err);
    return apiError(500, "SERVER_ERROR", "Failed to load signing request.");
  }
}

// DELETE /api/signing/requests/[id] — permanently delete a request
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      select: { id: true, agentId: true, status: true, expiresAt: true },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

    // Compute effective status (check expiry)
    const now = new Date();
    const effectiveStatus =
      (request.status === "SENT" || request.status === "OPENED") && request.expiresAt < now
        ? "EXPIRED"
        : request.status;

    if (effectiveStatus === "COMPLETED") {
      return apiError(409, "CONFLICT", "Completed documents cannot be deleted.");
    }
    if (effectiveStatus === "SENT" || effectiveStatus === "OPENED") {
      return apiError(409, "CONFLICT", "Void the request before deleting it.");
    }

    await db.docSignRequest.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[signing/requests/delete]", err);
    return apiError(500, "SERVER_ERROR", "Failed to delete signing request.");
  }
}
