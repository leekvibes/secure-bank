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

    return apiSuccess({ request: { ...request, displayStatus, completedRecipients: completedCount } });
  } catch (err) {
    console.error("[signing/requests/get]", err);
    return apiError(500, "SERVER_ERROR", "Failed to load signing request.");
  }
}
