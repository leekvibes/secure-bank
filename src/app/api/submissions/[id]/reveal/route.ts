import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { decryptFields } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendRevealNotification } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`reveal:${params.id}:${session.user.id}:${ip}`);
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes.");
  }

  const submission = await db.submission.findFirst({
    where: { id: params.id, link: { agentId: session.user.id } },
    include: { link: true },
  });

  if (!submission) {
    return apiError(404, "NOT_FOUND", "Not found.");
  }

  let fields: Record<string, string>;
  try {
    const encryptedFields: Record<string, string> = JSON.parse(submission.encryptedData);
    fields = decryptFields(encryptedFields);
  } catch {
    return apiError(500, "DECRYPTION_FAILED", "Failed to decrypt submission.");
  }

  // Track reveal count and first-reveal timestamp (for audit, not gating)
  const isFirstReveal = submission.revealedAt === null;
  await db.submission.update({
    where: { id: submission.id },
    data: {
      revealedAt: isFirstReveal ? new Date() : submission.revealedAt,
      revealCount: { increment: 1 },
    },
  });

  await writeAuditLog({
    event: "REVEALED",
    agentId: session.user.id,
    linkId: submission.linkId,
    request: req,
    metadata: { submissionId: submission.id, revealCount: submission.revealCount + 1 },
  });

  // Security email on every reveal
  const agent = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, displayName: true },
  });
  if (agent) {
    sendRevealNotification({
      agentEmail: agent.email,
      agentName: agent.displayName,
      clientName: submission.link.clientName,
      revealedAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
      viewUrl: `${process.env.NEXTAUTH_URL}/dashboard/submissions/${submission.id}`,
    });
  }

  return apiSuccess({ fields });
}
