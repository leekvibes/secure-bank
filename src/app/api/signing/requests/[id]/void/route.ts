import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

// POST /api/signing/requests/[id]/void
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      select: { id: true, agentId: true, status: true },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (request.status === "COMPLETED") return apiError(409, "CONFLICT", "Cannot void a completed document.");
    if (request.status === "VOIDED") return apiError(409, "CONFLICT", "Already voided.");

    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim() || null;

    await db.$transaction([
      db.docSignRequest.update({
        where: { id: request.id },
        data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
      }),
      db.docSignAuditLog.create({
        data: {
          requestId: request.id,
          event: "VOIDED",
          metadata: reason ? JSON.stringify({ reason }) : null,
        },
      }),
    ]);

    return apiSuccess({ voided: true });
  } catch (err) {
    console.error("[signing/void]", err);
    return apiError(500, "SERVER_ERROR", "Failed to void request.");
  }
}
