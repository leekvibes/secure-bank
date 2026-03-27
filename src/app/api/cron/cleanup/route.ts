import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  sendRequestReminder,
  sendRequestExpiredToAgent,
  sendRequestExpiredToClient,
} from "@/lib/email";
import { deleteFile } from "@/lib/files";

export const dynamic = "force-dynamic";

/**
 * Cleanup cron endpoint — runs nightly via Vercel Cron.
 *
 * 1) Sends 24-hour reminder emails to clients who haven't submitted
 * 2) Marks expired links as EXPIRED + emails agent + client
 * 3) Marks expired form links as EXPIRED
 * 4) Deletes sensitive records past retention (`deleteAt`)
 *
 * Protected by CRON_SECRET env var.
 * Vercel calls this with: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const provided = authHeader?.replace("Bearer ", "") ?? querySecret;
    if (provided !== cronSecret) {
      return apiError(401, "UNAUTHORIZED", "Unauthorized");
    }
  }

  const now = new Date();
  const typeLabels: Record<string, string> = {
    BANKING_INFO: "Banking Information",
    SSN_ONLY: "SSN (Secure)",
    FULL_INTAKE: "Full Intake",
    ID_UPLOAD: "ID Document Upload",
  };
  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

  // ── 1. Send 24-hour reminders ─────────────────────────────────────────────
  // Links that: have a client email, haven't been submitted, aren't expired,
  // were created 20-28 hrs ago (buffer window), and haven't had a reminder sent
  const reminderWindowStart = new Date(now.getTime() - 28 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const reminderLinks = await db.secureLink.findMany({
    where: {
      status: { in: ["CREATED", "OPENED"] },
      clientEmail: { not: null },
      reminderSentAt: null,
      expiresAt: { gt: now },
      createdAt: { gte: reminderWindowStart, lte: reminderWindowEnd },
    },
    include: { agent: { select: { displayName: true } } },
  });

  let remindersSent = 0;
  for (const link of reminderLinks) {
    if (!link.clientEmail) continue;
    try {
      await sendRequestReminder({
        toEmail: link.clientEmail,
        clientName: link.clientName ?? "there",
        requestType: typeLabels[link.linkType] ?? link.linkType,
        expiresAt: link.expiresAt.toLocaleString("en-US", { timeZone: "America/New_York" }),
        secureUrl: `${appUrl}/secure/${link.token}`,
        agentName: link.agent.displayName,
      });
      await db.secureLink.update({
        where: { id: link.id },
        data: { reminderSentAt: now },
      });
      remindersSent++;
    } catch (err) {
      console.error("[cron] Reminder send failed for link", link.id, err);
    }
  }

  // ── 2. Mark expired secure links + email agent + client ───────────────────
  const expiringLinks = await db.secureLink.findMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    include: { agent: { select: { email: true, displayName: true } } },
  });

  let expiredLinks = 0;
  for (const link of expiringLinks) {
    await db.secureLink.update({
      where: { id: link.id },
      data: { status: "EXPIRED" },
    });
    expiredLinks++;

    const requestType = typeLabels[link.linkType] ?? link.linkType;
    const expiredAt = now.toLocaleString("en-US", { timeZone: "America/New_York" });

    // Email agent
    sendRequestExpiredToAgent({
      agentEmail: link.agent.email,
      agentName: link.agent.displayName,
      clientName: link.clientName,
      requestType,
      expiredAt,
      resendUrl: `${appUrl}/dashboard/new`,
    });

    // Email client if we have their address
    if (link.clientEmail) {
      sendRequestExpiredToClient({
        toEmail: link.clientEmail,
        clientName: link.clientName ?? "there",
        agentName: link.agent.displayName,
        requestType,
      });
    }
  }

  // ── 3. Mark expired form links ────────────────────────────────────────────
  const { count: expiredFormLinks } = await db.formLink.updateMany({
    where: {
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // ── 4. Retention deletion ────────────────────────────────────────────────
  const expiredUploads = await db.idUpload.findMany({
    where: { deleteAt: { lt: now } },
    select: { id: true, frontFilePath: true, backFilePath: true },
    take: 500,
  });

  await Promise.allSettled(
    expiredUploads.flatMap((upload) => {
      const paths = [upload.frontFilePath, upload.backFilePath].filter(
        (path): path is string => Boolean(path)
      );
      return paths.map((path) => deleteFile(path));
    })
  );

  let deletedUploads = 0;
  if (expiredUploads.length > 0) {
    const result = await db.idUpload.deleteMany({
      where: { id: { in: expiredUploads.map((upload) => upload.id) } },
    });
    deletedUploads = result.count;
  }

  const [{ count: deletedSubmissions }, { count: deletedFormSubmissions }] =
    await Promise.all([
      db.submission.deleteMany({ where: { deleteAt: { lt: now } } }),
      db.formSubmission.deleteMany({ where: { deleteAt: { lt: now } } }),
    ]);

  return apiSuccess({
    success: true,
    remindersSent,
    expiredLinks,
    expiredFormLinks,
    deletedSubmissions,
    deletedFormSubmissions,
    deletedUploads,
    ranAt: now.toISOString(),
  });
}
