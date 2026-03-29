import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

// POST /api/sign/[token]/consent
// Records that the recipient has given electronic consent under ESIGN Act.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: { select: { id: true, status: true, expiresAt: true } },
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (recipient.request.status === "VOIDED")
    return apiError(410, "VOIDED", "This document has been voided.");
  if (recipient.request.expiresAt < new Date())
    return apiError(410, "EXPIRED", "This signing link has expired.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already signed.");
  if (recipient.status === "DECLINED")
    return apiError(410, "DECLINED", "You have declined this request.");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;

  // Record consent (idempotent — only set once)
  if (!recipient.consentAt) {
    await db.docSignRecipient.update({
      where: { id: recipient.id },
      data: { consentAt: new Date(), ipAddress: ip ?? recipient.ipAddress, userAgent: ua ?? recipient.userAgent },
    });

    await db.docSignAuditLog.create({
      data: {
        requestId: recipient.requestId,
        event: "CONSENT",
        ipAddress: ip,
        userAgent: ua,
        recipientId: recipient.id,
        metadata: JSON.stringify({ esign: true }),
      },
    });
  }

  return apiSuccess({ consented: true });
}
