import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { addHours } from "date-fns";
import { z } from "zod";

const schema = z.object({
  recipients: z
    .array(
      z.object({
        name: z.string().min(1, "Name required").max(100),
        email: z.string().email("Valid email required"),
        phone: z.string().max(30).optional().nullable(),
        order: z.number().int().min(0).optional(),
      })
    )
    .min(1, "At least one recipient is required")
    .max(10, "Maximum 10 recipients"),
  signingMode: z.enum(["PARALLEL", "SEQUENTIAL"]).default("PARALLEL"),
  authLevel: z.enum(["LINK_ONLY", "EMAIL_OTP", "SMS_OTP"]).optional(),
  ccEmails: z.array(z.string().email()).max(20).optional(),
  message: z.string().max(1000).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

// POST /api/signing/requests/[id]/recipients
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      select: { id: true, agentId: true, status: true, blobUrl: true },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (request.status !== "DRAFT") return apiError(409, "CONFLICT", "Cannot edit recipients after sending.");
    if (!request.blobUrl) return apiError(400, "NO_DOCUMENT", "Upload a document before adding recipients.");

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
    }

    const { recipients, signingMode, authLevel, ccEmails, message, expiresInHours } = parsed.data;

    // Replace all existing recipients (idempotent — can be called multiple times in DRAFT)
    await db.docSignRecipient.deleteMany({ where: { requestId: request.id } });

    const created = await db.$transaction(
      recipients.map((r, idx) =>
        db.docSignRecipient.create({
          data: {
            requestId: request.id,
            name: r.name.trim(),
            email: r.email.toLowerCase().trim(),
            phone: r.phone ?? null,
            order: r.order ?? idx,
            token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          },
          select: { id: true, name: true, email: true, order: true },
        })
      )
    );

    // Update request metadata
    const updates: Record<string, unknown> = {
      signingMode,
      ccEmails: ccEmails && ccEmails.length > 0 ? JSON.stringify(ccEmails) : null,
    };
    if (authLevel !== undefined) updates.authLevel = authLevel;
    if (message !== undefined) updates.message = message.trim() || null;
    if (expiresInHours !== undefined) updates.expiresAt = addHours(new Date(), expiresInHours);

    await db.docSignRequest.update({
      where: { id: request.id },
      data: updates,
    });

    return apiSuccess({ recipients: created });
  } catch (err) {
    console.error("[signing/recipients]", err);
    return apiError(500, "SERVER_ERROR", "Failed to save recipients.");
  }
}
