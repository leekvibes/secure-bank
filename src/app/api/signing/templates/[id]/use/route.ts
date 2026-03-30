import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";
import { addDays } from "date-fns";
import { CONSENT_TEXT_V1, CURRENT_CONSENT_VERSION } from "@/lib/signing/consent-text";
import { checkDocSignLimit, getPlan } from "@/lib/plans";

const schema = z.object({
  slots: z.array(
    z.object({
      slotIndex: z.number().int().min(0),
      name: z.string().min(1).max(100),
      email: z.string().email(),
      phone: z.string().max(30).nullable().optional(),
    })
  ).min(1).max(10),
  signingMode: z.enum(["PARALLEL", "SEQUENTIAL"]).default("PARALLEL"),
  authLevel: z.enum(["LINK_ONLY", "EMAIL_OTP", "SMS_OTP"]).default("LINK_ONLY"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const template = await db.docSignTemplate.findUnique({
    where: { id: params.id },
    include: { recipientSlots: { orderBy: { slotIndex: "asc" } } },
  });

  if (!template) return apiError(404, "NOT_FOUND", "Template not found.");
  if (template.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
  }

  const { slots, signingMode, authLevel, expiresInDays } = parsed.data;

  // Validate all required slots are covered
  const requiredSlotIndexes = template.recipientSlots.map((s) => s.slotIndex);
  const providedIndexes = slots.map((s) => s.slotIndex);
  for (const idx of requiredSlotIndexes) {
    if (!providedIndexes.includes(idx)) {
      return apiError(400, "MISSING_SLOT", `Slot ${idx} must be assigned.`);
    }
  }

  // Check plan limit
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const plan = user?.plan ?? "FREE";
  const limitCheck = await checkDocSignLimit(db, session.user.id, plan);
  if (!limitCheck.allowed) {
    const planConfig = getPlan(plan);
    return apiError(
      403,
      "PLAN_LIMIT",
      `You've used ${limitCheck.used}/${limitCheck.limit} document signatures this month on the ${planConfig.name} plan. Upgrade to send more.`
    );
  }

  const fields: Array<{ type: string; page: number; x: number; y: number; width: number; height: number; required: boolean; options: string | null; slotIndex: number }> = JSON.parse(template.fieldsJson);
  const pages: Array<{ page: number; widthPts: number; heightPts: number }> = JSON.parse(template.pagesJson);

  const requestToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  const newRequest = await db.$transaction(async (tx) => {
    // 1. Create the request
    const signingRequest = await tx.docSignRequest.create({
      data: {
        agentId: session.user.id,
        token: requestToken,
        title: template.title,
        originalName: template.originalName,
        status: "DRAFT",
        blobUrl: template.blobUrl,
        signingMode,
        authLevel,
        expiresAt: addDays(new Date(), expiresInDays),
        consentText: CONSENT_TEXT_V1,
        consentVersion: CURRENT_CONSENT_VERSION,
      },
    });

    // 2. Create pages
    await tx.docSignPage.createMany({
      data: pages.map((p) => ({ requestId: signingRequest.id, page: p.page, widthPts: p.widthPts, heightPts: p.heightPts })),
    });

    // 3. Create recipients
    const createdRecipients = await Promise.all(
      slots.map((slot) =>
        tx.docSignRecipient.create({
          data: {
            requestId: signingRequest.id,
            name: slot.name.trim(),
            email: slot.email.toLowerCase().trim(),
            phone: slot.phone ?? null,
            order: slot.slotIndex,
            token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          },
          select: { id: true, order: true },
        })
      )
    );

    // Map slotIndex → recipientId
    const slotToRecipient = new Map(createdRecipients.map((r) => [r.order, r.id]));

    // 4. Create fields
    if (fields.length > 0) {
      await tx.docSignField.createMany({
        data: fields.map((f) => ({
          requestId: signingRequest.id,
          recipientId: slotToRecipient.get(f.slotIndex) ?? createdRecipients[0].id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          required: f.required,
          options: f.options,
        })),
      });
    }

    // 5. Audit log
    await tx.docSignAuditLog.create({
      data: {
        requestId: signingRequest.id,
        event: "CREATED_FROM_TEMPLATE",
        metadata: JSON.stringify({ templateId: template.id, templateTitle: template.title }),
      },
    });

    return signingRequest;
  });

  return apiSuccess({ requestId: newRequest.id });
}
