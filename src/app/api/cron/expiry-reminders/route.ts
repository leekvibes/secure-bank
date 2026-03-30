import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { addDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const provided = authHeader?.replace("Bearer ", "") ?? querySecret;
    if (provided !== cronSecret) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const now = new Date();
  const warningCutoff = addDays(now, 3);
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

  // Find all SENT/OPENED requests expiring within 3 days, no reminder yet, not deleted
  const expiringRequests = await db.docSignRequest.findMany({
    where: {
      status: { in: ["SENT", "OPENED"] },
      expiresAt: { gte: now, lte: warningCutoff },
      expiryReminderSentAt: null,
      deletedAt: null,
    },
    include: {
      agent: { select: { displayName: true } },
      recipients: {
        where: { status: { in: ["PENDING", "OPENED"] } },
        orderBy: { order: "asc" },
      },
    },
  });

  let remindersSent = 0;

  for (const request of expiringRequests) {
    const daysLeft = Math.ceil((request.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // For SEQUENTIAL mode, only notify the first pending recipient
    const recipientsToNotify =
      request.signingMode === "SEQUENTIAL"
        ? request.recipients.slice(0, 1)
        : request.recipients;

    for (const recipient of recipientsToNotify) {
      try {
        const { sendDocSignExpiryReminderEmail } = await import("@/lib/email");
        await sendDocSignExpiryReminderEmail({
          toEmail: recipient.email,
          recipientName: recipient.name,
          agentName: request.agent.displayName,
          title: request.title,
          signUrl: `${baseUrl}/sign/${recipient.token}`,
          expiresAt: request.expiresAt,
          daysLeft,
        });
        remindersSent++;
      } catch {
        // Non-critical
      }
    }

    await db.docSignRequest.update({
      where: { id: request.id },
      data: {
        expiryReminderSentAt: now,
      },
    });

    await db.docSignAuditLog.create({
      data: {
        requestId: request.id,
        event: "EXPIRY_REMINDER_SENT",
        metadata: JSON.stringify({ daysLeft, recipientCount: recipientsToNotify.length }),
      },
    });
  }

  return apiSuccess({ success: true, remindersSent, requestsProcessed: expiringRequests.length, ranAt: now.toISOString() });
}
