import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";

const schema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).nullable().optional(),
  })
  .refine((d) => d.name || d.email || d.phone !== undefined, {
    message: "At least one field must be provided.",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; recipientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      agentId: true,
      status: true,
      title: true,
      message: true,
      expiresAt: true,
      agent: { select: { displayName: true } },
    },
  });

  if (!request) return apiError(404, "NOT_FOUND", "Request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (!["SENT", "OPENED"].includes(request.status))
    return apiError(409, "CONFLICT", "Can only reassign recipients on sent requests.");

  const recipient = await db.docSignRecipient.findFirst({
    where: { id: params.recipientId, requestId: params.id },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Recipient not found.");
  if (["COMPLETED", "DECLINED"].includes(recipient.status))
    return apiError(409, "CONFLICT", "Cannot reassign a recipient who has already signed or declined.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
  }

  const { name, email, phone } = parsed.data;
  const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const newName = name?.trim() ?? recipient.name;
  const newEmail = email?.toLowerCase().trim() ?? recipient.email;

  await db.$transaction([
    db.docSignRecipient.update({
      where: { id: recipient.id },
      data: {
        name: newName,
        email: newEmail,
        phone: phone !== undefined ? (phone ?? null) : recipient.phone,
        token: newToken,
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        status: "PENDING",
        openedAt: null,
        consentAt: null,
        emailOtpVerifiedAt: null,
        smsOtpVerifiedAt: null,
      },
    }),
    db.docSignAuditLog.create({
      data: {
        requestId: params.id,
        event: "RECIPIENT_REASSIGNED",
        metadata: JSON.stringify({
          recipientId: recipient.id,
          oldEmail: recipient.email,
          newEmail,
          oldName: recipient.name,
          newName,
        }),
      },
    }),
  ]);

  // Send invitation email to new address
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
  try {
    const { sendDocSignRequestEmail } = await import("@/lib/email");
    await sendDocSignRequestEmail({
      toEmail: newEmail,
      agentName: request.agent.displayName,
      title: request.title,
      message: request.message,
      signUrl: `${baseUrl}/sign/${newToken}`,
      expiresAt: request.expiresAt,
    });
  } catch {
    // Non-critical — log but don't fail
  }

  return apiSuccess({ reassigned: true, newEmail, newName });
}
