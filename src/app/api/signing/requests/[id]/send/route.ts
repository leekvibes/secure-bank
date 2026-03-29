import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendDocSignRequestEmail } from "@/lib/email";
import { checkDocSignLimit, getPlan } from "@/lib/plans";

// POST /api/signing/requests/[id]/send
// Validates the draft is complete, locks it to SENT, and emails recipients.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      include: {
        recipients: { orderBy: { order: "asc" } },
        signingFields: { select: { id: true } },
        agent: { select: { displayName: true, email: true, notificationEmail: true, plan: true } },
      },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (request.status !== "DRAFT") return apiError(409, "CONFLICT", "This request has already been sent.");

    // Re-validate plan limit at send time (prevents race: user created draft when under
    // limit, but another request was sent before this one, pushing them over).
    const agentPlan = request.agent.plan ?? "FREE";
    const { allowed, used, limit } = await checkDocSignLimit(db, session.user.id, agentPlan);
    if (!allowed) {
      const planConfig = getPlan(agentPlan);
      return apiError(
        403,
        "SIGNING_LIMIT_REACHED",
        `You've used ${used}/${limit} document signatures this month on the ${planConfig.name} plan. Upgrade to send more.`
      );
    }

    // Validate completeness
    if (!request.blobUrl) return apiError(400, "NO_DOCUMENT", "Upload a document before sending.");
    if (request.recipients.length === 0) return apiError(400, "NO_RECIPIENTS", "Add at least one recipient before sending.");
    if (request.signingFields.length === 0) return apiError(400, "NO_FIELDS", "Place at least one signing field before sending.");

    // Determine which recipients get emailed now
    // PARALLEL: all recipients at once
    // SEQUENTIAL: only the first (order=0) recipient
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
    const agentName = request.agent.displayName;

    const recipientsToNotify =
      request.signingMode === "SEQUENTIAL"
        ? request.recipients.filter((r) => r.order === 0)
        : request.recipients;

    // Lock the request status first
    await db.docSignRequest.update({
      where: { id: request.id },
      data: { status: "SENT" },
    });

    await db.docSignAuditLog.create({
      data: {
        requestId: request.id,
        event: "SENT",
        metadata: JSON.stringify({
          recipientCount: request.recipients.length,
          fieldCount: request.signingFields.length,
          signingMode: request.signingMode,
        }),
      },
    });

    // Send emails — await each send so errors are captured and returned
    const emailResults: Array<{ email: string; sent: boolean; error?: string }> = [];
    for (const recipient of recipientsToNotify) {
      const signUrl = `${baseUrl}/sign/${recipient.token}`;
      const result = await sendDocSignRequestEmail({
        toEmail: recipient.email,
        agentName,
        title: request.title,
        message: request.message,
        signUrl,
        expiresAt: request.expiresAt,
      });
      emailResults.push({ email: recipient.email, sent: result.success, error: result.error });
      if (!result.success) {
        console.error(`[signing/send] email failed for ${recipient.email}:`, result.error);
      }
    }

    // Send CC copies (notification only, no signing link)
    if (request.ccEmails) {
      try {
        const ccList: string[] = JSON.parse(request.ccEmails);
        const recipientNames = request.recipients.map((r) => r.name).join(", ");
        const viewUrl = `${baseUrl}/dashboard/signing/${request.id}`;
        for (const ccEmail of ccList) {
          sendDocSignRequestEmail({
            toEmail: ccEmail,
            agentName,
            title: request.title ? `[CC] ${request.title}` : "[CC] Document sent for signature",
            message: `You are CC'd on this signing request. Recipients: ${recipientNames}. View the request at: ${viewUrl}`,
            signUrl: viewUrl,
            expiresAt: request.expiresAt,
          }).catch(() => {});
        }
      } catch {
        // malformed ccEmails JSON — not fatal
      }
    }

    const allEmailsSent = emailResults.every((r) => r.sent);
    const failedEmails = emailResults.filter((r) => !r.sent);

    return apiSuccess({
      sent: true,
      recipientsNotified: recipientsToNotify.length,
      emailConfigured: !!process.env.RESEND_API_KEY,
      emailResults,
      emailWarning: failedEmails.length > 0
        ? `Email delivery failed for ${failedEmails.length} recipient(s): ${failedEmails.map((r) => r.email).join(", ")}. Use the signing links to share manually.`
        : null,
    });
    void allEmailsSent;
  } catch (err) {
    console.error("[signing/send]", err);
    return apiError(500, "SERVER_ERROR", "Failed to send signing request.");
  }
}
