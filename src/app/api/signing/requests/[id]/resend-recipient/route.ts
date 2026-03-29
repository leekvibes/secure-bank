import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendDocSignRequestEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  recipientId: z.string().min(1),
  // Optional override — if provided, updates the recipient's email before sending
  email: z.string().email("Must be a valid email").optional(),
});

// POST /api/signing/requests/[id]/resend-recipient
// Re-sends the signing email to one specific recipient.
// If `email` is provided it updates the recipient's address first.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
    }

    const { recipientId, email } = parsed.data;

    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      include: {
        recipients: { orderBy: { order: "asc" } },
        agent: { select: { displayName: true } },
      },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (request.status === "VOIDED" || request.status === "COMPLETED") {
      return apiError(409, "CONFLICT", "Cannot resend on a voided or completed request.");
    }

    const recipient = request.recipients.find((r) => r.id === recipientId);
    if (!recipient) return apiError(404, "NOT_FOUND", "Recipient not found.");
    if (recipient.status === "COMPLETED") {
      return apiError(409, "ALREADY_SIGNED", "This recipient has already signed.");
    }
    if (recipient.status === "DECLINED") {
      return apiError(409, "DECLINED", "This recipient declined. Void and create a new request.");
    }

    // Update email if a different address was provided
    let sendToEmail = recipient.email;
    if (email && email.toLowerCase() !== recipient.email.toLowerCase()) {
      await db.docSignRecipient.update({
        where: { id: recipientId },
        data: { email: email.toLowerCase().trim() },
      });
      sendToEmail = email.toLowerCase().trim();
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
    const signUrl = `${baseUrl}/sign/${recipient.token}`;

    const result = await sendDocSignRequestEmail({
      toEmail: sendToEmail,
      agentName: request.agent.displayName,
      title: request.title,
      message: request.message,
      signUrl,
      expiresAt: request.expiresAt,
    });

    await db.docSignAuditLog.create({
      data: {
        requestId: request.id,
        event: "REMINDER_SENT",
        recipientId,
        metadata: JSON.stringify({
          sentTo: sendToEmail,
          emailUpdated: email && email.toLowerCase() !== recipient.email.toLowerCase(),
          emailSent: result.success,
          emailError: result.error ?? null,
        }),
      },
    });

    if (!result.success) {
      return apiError(502, "EMAIL_FAILED", result.error ?? "Failed to send email. Check your email configuration.");
    }

    return apiSuccess({ sent: true, sentTo: sendToEmail });
  } catch (err) {
    console.error("[signing/resend-recipient]", err);
    return apiError(500, "SERVER_ERROR", "Failed to resend signing email.");
  }
}
