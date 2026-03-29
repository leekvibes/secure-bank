import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";

const FIELD_TYPES = [
  "SIGNATURE", "INITIALS", "DATE_SIGNED", "FULL_NAME",
  "TITLE", "COMPANY", "TEXT", "CHECKBOX", "RADIO", "DROPDOWN", "ATTACHMENT",
] as const;

const fieldSchema = z.object({
  type: z.enum(FIELD_TYPES),
  recipientId: z.string().min(1),
  page: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
});

const schema = z.object({
  fields: z.array(fieldSchema).min(1, "At least one field is required").max(200),
});

// POST /api/signing/requests/[id]/fields — save (replace) field layout
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      select: {
        id: true, agentId: true, status: true,
        recipients: { select: { id: true, status: true } },
      },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

    // Allow editing fields if: DRAFT, or SENT/OPENED with no recipient having signed yet
    if (request.status === "VOIDED" || request.status === "COMPLETED" || request.status === "EXPIRED") {
      return apiError(409, "CONFLICT", "Cannot edit fields on a voided, expired, or completed request.");
    }
    if (request.status !== "DRAFT") {
      const signedCount = request.recipients.filter((r) => r.status === "COMPLETED").length;
      if (signedCount > 0) {
        return apiError(409, "CONFLICT", "Cannot edit fields after a recipient has already signed.");
      }
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
    }

    const { fields } = parsed.data;

    // Validate all recipientIds belong to this request
    const validRecipientIds = new Set(request.recipients.map((r) => r.id));
    const invalidField = fields.find((f) => !validRecipientIds.has(f.recipientId));
    if (invalidField) {
      return apiError(400, "INVALID_RECIPIENT", `Recipient ${invalidField.recipientId} does not belong to this request.`);
    }

    // Replace all fields atomically
    await db.$transaction([
      db.docSignField.deleteMany({ where: { requestId: request.id } }),
      ...fields.map((f) =>
        db.docSignField.create({
          data: {
            requestId: request.id,
            recipientId: f.recipientId,
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
            options: f.options && f.options.length > 0 ? JSON.stringify(f.options) : null,
          },
        })
      ),
    ]);

    return apiSuccess({ saved: fields.length });
  } catch (err) {
    console.error("[signing/fields]", err);
    return apiError(500, "SERVER_ERROR", "Failed to save fields.");
  }
}
