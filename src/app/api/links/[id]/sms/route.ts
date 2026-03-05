import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendSms, isTwilioConfigured } from "@/lib/sms";
import { LINK_TYPES } from "@/lib/utils";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { isValidPhoneNumber } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/api-response";

const schema = z.object({
  to: z
    .string()
    .min(7, "Phone number required")
    .max(30)
    .refine(isValidPhoneNumber, "Invalid phone number"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  if (!isTwilioConfigured()) {
    return apiError(503, "SMS_NOT_CONFIGURED", "SMS is not configured on this server.");
  }

  const link = await db.secureLink.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });

  if (!link) {
    return apiError(404, "LINK_NOT_FOUND", "Not found.");
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      parsed.error.flatten().fieldErrors.to?.[0] ?? "Invalid input."
    );
  }

  const baseUrl = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}/secure/${link.token}`;
  const clientFirst = link.clientName?.split(" ")[0] ?? "";
  const typeLabel =
    LINK_TYPES[link.linkType as keyof typeof LINK_TYPES] ?? "information";

  const message =
    `${clientFirst ? `Hi ${clientFirst}, ` : ""}I need to securely collect your ${typeLabel.toLowerCase()} ` +
    `for your application. Please tap this private encrypted link and enter it directly:\n\n${url}\n\nLet me know once you've submitted it.`;

  const result = await sendSms(parsed.data.to, message);

  if (!result.success) {
    return apiError(500, "SMS_SEND_FAILED", result.error ?? "Failed to send SMS.");
  }

  await writeAuditLog({
    event: "LINK_SENT",
    agentId: session.user.id,
    linkId: link.id,
    request: req,
    metadata: { action: "sms_sent" },
  });

  return apiSuccess({ success: true });
}
