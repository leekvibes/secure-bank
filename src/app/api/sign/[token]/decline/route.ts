import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  reason: z.string().max(500).optional(),
});

// POST /api/sign/[token]/decline
// Recipient declines to sign. Voids the entire request and notifies the agent.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: {
        include: {
          agent: { select: { displayName: true, email: true } },
        },
      },
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (recipient.request.status === "VOIDED")
    return apiError(410, "VOIDED", "This document has already been voided.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already signed this document.");
  if (recipient.status === "DECLINED")
    return apiError(409, "ALREADY_DECLINED", "You have already declined.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const reason = parsed.success
    ? (parsed.data.reason?.trim() ?? null)
    : null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;

  const now = new Date();

  await db.$transaction([
    db.docSignRecipient.update({
      where: { id: recipient.id },
      data: { status: "DECLINED", declinedAt: now, declineReason: reason },
    }),
    db.docSignRequest.update({
      where: { id: recipient.requestId },
      data: { status: "VOIDED", voidedAt: now, voidReason: `Declined by ${recipient.name}${reason ? `: ${reason}` : ""}` },
    }),
    db.docSignAuditLog.create({
      data: {
        requestId: recipient.requestId,
        event: "DECLINED",
        ipAddress: ip,
        userAgent: ua,
        recipientId: recipient.id,
        metadata: reason ? JSON.stringify({ reason }) : null,
      },
    }),
    db.docSignAuditLog.create({
      data: {
        requestId: recipient.requestId,
        event: "VOIDED",
        ipAddress: ip,
        metadata: JSON.stringify({ reason: `Declined by ${recipient.name}` }),
      },
    }),
  ]);

  // Notify agent
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
  const request = recipient.request;
  try {
    const { sendDocSignDeclinedEmail } = await import("@/lib/email");
    sendDocSignDeclinedEmail({
      agentEmail: request.agent.email,
      agentName: request.agent.displayName,
      recipientName: recipient.name,
      title: request.title,
      declineReason: reason,
      viewUrl: `${baseUrl}/dashboard/signing/${recipient.requestId}`,
    }).catch(() => {});
  } catch {
    /* non-critical */
  }

  return apiSuccess({ declined: true });
}
