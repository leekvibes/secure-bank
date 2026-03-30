import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

// POST /api/sign/[token]/verify-otp
// Verifies the 6-digit OTP entered by the recipient.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  let otp: string;
  try {
    const body = await req.json();
    if (typeof body?.otp !== "string" || !body.otp.trim()) {
      return apiError(400, "VALIDATION_ERROR", "otp is required.");
    }
    otp = body.otp.trim();
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid request body.");
  }

  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
          authLevel: true,
        },
      },
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");

  const { request } = recipient;

  if (request.expiresAt < new Date())
    return apiError(410, "EXPIRED", "This signing link has expired.");
  if (request.status === "VOIDED")
    return apiError(410, "VOIDED", "This document has been voided.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already signed this document.");
  if (recipient.status === "DECLINED")
    return apiError(410, "DECLINED", "You have declined this request.");

  if (!recipient.otpHash) {
    return apiError(400, "NO_OTP_PENDING", "No OTP pending. Request a new code first.");
  }

  const now = new Date();
  if (!recipient.otpExpiresAt || recipient.otpExpiresAt < now) {
    // Clear expired OTP
    await db.docSignRecipient.update({
      where: { token: params.token },
      data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    return apiError(410, "OTP_EXPIRED", "Code has expired. Request a new code.");
  }

  if (recipient.otpAttempts >= 5) {
    return apiError(429, "TOO_MANY_ATTEMPTS", "Too many failed attempts. Request a new code.");
  }

  // Increment attempts before comparing (prevent timing-based enumeration)
  await db.docSignRecipient.update({
    where: { token: params.token },
    data: { otpAttempts: { increment: 1 } },
  });

  const valid = await bcrypt.compare(otp, recipient.otpHash);

  if (!valid) {
    const usedAttempts = recipient.otpAttempts + 1; // already incremented
    const remaining = 5 - usedAttempts;
    const msg =
      remaining <= 0
        ? "No attempts remaining. Request a new code."
        : `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`;
    return apiError(401, "INVALID_OTP", msg);
  }

  // Success — clear OTP and mark verification timestamp
  const authLevel = request.authLevel ?? "LINK_ONLY";
  const channel = authLevel === "SMS_OTP" ? "sms" : "email";
  const verifiedNow = new Date();

  await db.docSignRecipient.update({
    where: { token: params.token },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      ...(channel === "email" ? { emailOtpVerifiedAt: verifiedNow } : {}),
      ...(channel === "sms" ? { smsOtpVerifiedAt: verifiedNow } : {}),
    },
  });

  await db.docSignAuditLog.create({
    data: {
      requestId: request.id,
      event: "OTP_VERIFIED",
      recipientId: recipient.id,
      metadata: JSON.stringify({ channel }),
    },
  });

  return apiSuccess({ verified: true, channel });
}
