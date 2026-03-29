import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendDocSignRequestEmail } from "@/lib/email";

// POST /api/signing/requests/[id]/remind
// Re-sends the signing email to all pending recipients.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      include: {
        recipients: { orderBy: { order: "asc" } },
        agent: { select: { displayName: true } },
      },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (request.status !== "SENT" && request.status !== "OPENED") {
      return apiError(409, "CONFLICT", "Can only remind on active (sent/opened) requests.");
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
    const agentName = request.agent.displayName;

    // Only remind pending recipients
    const pending = request.recipients.filter((r) => r.status === "PENDING" || r.status === "OPENED");

    // For sequential, only remind the earliest pending recipient
    const toRemind =
      request.signingMode === "SEQUENTIAL" ? pending.slice(0, 1) : pending;

    for (const recipient of toRemind) {
      sendDocSignRequestEmail({
        toEmail: recipient.email,
        agentName,
        title: request.title ? `Reminder: ${request.title}` : "Reminder: document awaiting your signature",
        message: request.message,
        signUrl: `${baseUrl}/sign/${recipient.token}`,
        expiresAt: request.expiresAt,
      }).catch(() => {});
    }

    await db.docSignAuditLog.create({
      data: {
        requestId: request.id,
        event: "REMINDER_SENT",
        metadata: JSON.stringify({ remindedCount: toRemind.length }),
      },
    });

    return apiSuccess({ reminded: toRemind.length });
  } catch (err) {
    console.error("[signing/remind]", err);
    return apiError(500, "SERVER_ERROR", "Failed to send reminders.");
  }
}
