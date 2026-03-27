import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendDocSignRequestEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: { agent: { select: { displayName: true, email: true } } },
  });
  if (!doc) return apiError(404, "NOT_FOUND", "Document not found.");
  if (doc.status !== "DRAFT") return apiError(400, "ALREADY_SENT", "Document has already been sent.");
  if (!doc.clientEmail) return apiError(400, "NO_CLIENT_EMAIL", "Client email is required to send.");

  await db.docSignRequest.update({
    where: { id: params.id },
    data: { status: "SENT" },
  });

  await db.docSignAuditLog.create({
    data: { requestId: params.id, event: "SENT", metadata: JSON.stringify({ to: doc.clientEmail }) },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
  sendDocSignRequestEmail({
    toEmail: doc.clientEmail,
    agentName: doc.agent.displayName,
    title: doc.title,
    message: doc.message,
    signUrl: `${appUrl}/sign/${doc.token}`,
    expiresAt: doc.expiresAt,
  });

  return apiSuccess({ success: true });
}
