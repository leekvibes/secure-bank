import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  requestId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  slots: z
    .array(z.object({ slotIndex: z.number().int().min(0), role: z.string().min(1).max(100) }))
    .optional(),
});

// GET /api/signing/templates — list agent's templates
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const templates = await db.docSignTemplate.findMany({
    where: { agentId: session.user.id },
    include: { recipientSlots: { orderBy: { slotIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess({ templates });
}

// POST /api/signing/templates — save a request as a template
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return apiError(400, "VALIDATION_ERROR", first ?? "Invalid input.");
  }

  const { requestId, title, slots } = parsed.data;

  const request = await db.docSignRequest.findUnique({
    where: { id: requestId },
    include: {
      recipients: { orderBy: { order: "asc" } },
      signingFields: { orderBy: [{ page: "asc" }, { y: "asc" }] },
      pages: { orderBy: { page: "asc" } },
    },
  });

  if (!request) return apiError(404, "NOT_FOUND", "Request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
  if (!request.blobUrl) return apiError(400, "NO_DOCUMENT", "Request has no document.");

  // Build slotIndex map: recipientId → order (= slotIndex)
  const recipientSlotMap = new Map(request.recipients.map((r) => [r.id, r.order]));

  const fieldsJson = JSON.stringify(
    request.signingFields.map((f) => ({
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
      options: f.options ?? null,
      slotIndex: recipientSlotMap.get(f.recipientId) ?? 0,
    }))
  );

  const pagesJson = JSON.stringify(
    request.pages.map((p) => ({ page: p.page, widthPts: p.widthPts, heightPts: p.heightPts }))
  );

  const templateTitle = title?.trim() || request.title?.trim() || request.originalName || "Untitled Template";

  const template = await db.$transaction(async (tx) => {
    const t = await tx.docSignTemplate.create({
      data: {
        agentId: session.user.id,
        title: templateTitle,
        originalName: request.originalName,
        blobUrl: request.blobUrl!,
        fieldsJson,
        pagesJson,
      },
    });

    const slotData = request.recipients.map((r) => ({
      templateId: t.id,
      slotIndex: r.order,
      role: slots?.find((s) => s.slotIndex === r.order)?.role ?? r.name,
    }));

    await tx.docSignTemplateSlot.createMany({ data: slotData });
    return t;
  });

  return apiSuccess({ templateId: template.id, title: template.title });
}
