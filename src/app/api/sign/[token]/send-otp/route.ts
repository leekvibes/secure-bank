import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendOtpEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return (user ?? "").slice(0, 2) + "***@" + (domain ?? "");
}

function maskPhone(phone: string): string {
  return "***-***-" + phone.slice(-4);
}

// POST /api/sign/[token]/send-otp
// Generates and delivers a 6-digit OTP to the recipient via email or SMS,
// depending on the request's authLevel.
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
          authLevel: true,
          title: true,
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
  if (request.status === "COMPLETED")
    return apiError(410, "COMPLETED", "This document has already been completed.");
  if (recipient.status === "COMPLETED")
    return apiError(409, "ALREADY_SIGNED", "You have already signed this document.");
  if (recipient.status === "DECLINED")
    return apiError(410, "DECLINED", "You have declined this request.");

  const authLevel = request.authLevel ?? "LINK_ONLY";

  if (authLevel === "LINK_ONLY") {
    return apiError(400, "NOT_REQUIRED", "OTP not required for this document.");
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Persist OTP hash
  await db.docSignRecipient.update({
    where: { token: params.token },
    data: { otpHash: hash, otpExpiresAt, otpAttempts: 0 },
  });

  if (authLevel === "EMAIL_OTP") {
    const result = await sendOtpEmail({
      toEmail: recipient.email,
      recipientName: recipient.name,
      otp,
      documentTitle: request.title,
    });
    if (!result.success) {
      return apiError(500, "EMAIL_SEND_FAILED", result.error ?? "Failed to send verification email.");
    }
    return apiSuccess({
      sent: true,
      channel: "email" as const,
      maskedTarget: maskEmail(recipient.email),
    });
  }

  if (authLevel === "SMS_OTP") {
    if (!recipient.phone) {
      return apiError(400, "NO_PHONE", "No phone number configured for SMS verification.");
    }
    const result = await sendSms(
      recipient.phone,
      `Your signing code: ${otp}. Expires in 10 minutes.`
    );
    if (!result.success) {
      return apiError(500, "SMS_SEND_FAILED", result.error ?? "Failed to send verification SMS.");
    }
    return apiSuccess({
      sent: true,
      channel: "sms" as const,
      maskedTarget: maskPhone(recipient.phone),
    });
  }

  return apiError(400, "UNKNOWN_AUTH_LEVEL", "Unrecognized authentication level.");
}
