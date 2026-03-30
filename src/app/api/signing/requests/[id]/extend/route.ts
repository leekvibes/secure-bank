import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";
import { addDays } from "date-fns";

const schema = z.object({
  days: z.number().int().min(1).max(30),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true, status: true, expiresAt: true },
  });

  if (!request) return apiError(404, "NOT_FOUND", "Request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (!["SENT", "OPENED"].includes(request.status))
    return apiError(409, "CONFLICT", "Can only extend sent requests.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Days must be between 1 and 30.");
  }

  const { days } = parsed.data;
  // Extend from whichever is later: current expiry or now
  const baseTime = Math.max(request.expiresAt.getTime(), Date.now());
  const newExpiresAt = addDays(new Date(baseTime), days);

  await db.$transaction([
    db.docSignRequest.update({
      where: { id: params.id },
      data: { expiresAt: newExpiresAt, expiryReminderSentAt: null },
    }),
    db.docSignAuditLog.create({
      data: {
        requestId: params.id,
        event: "DEADLINE_EXTENDED",
        metadata: JSON.stringify({ days, newExpiresAt: newExpiresAt.toISOString() }),
      },
    }),
  ]);

  return apiSuccess({ extended: true, newExpiresAt: newExpiresAt.toISOString() });
}
