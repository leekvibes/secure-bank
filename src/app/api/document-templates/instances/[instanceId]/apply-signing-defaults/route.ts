import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { parseSigningDefaults } from "@/lib/document-templates/schema";
import { z } from "zod";
import { isDocumentTemplatesEnabledServer } from "@/lib/feature-flags";

const bodySchema = z.object({
  recipientRoleMap: z.record(z.string().min(1)).default({}),
});

// POST /api/document-templates/instances/[instanceId]/apply-signing-defaults
export async function POST(
  req: NextRequest,
  { params }: { params: { instanceId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");
  if (!isDocumentTemplatesEnabledServer()) {
    return apiError(404, "NOT_FOUND", "Document templates are disabled.");
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const parsedBody = bodySchema.safeParse(payload);
    if (!parsedBody.success) return apiError(400, "VALIDATION_ERROR", "Invalid recipient role map.");

    const instance = await db.documentTemplateInstance.findUnique({
      where: { id: params.instanceId },
      include: {
        template: true,
        request: {
          include: {
            recipients: {
              select: { id: true, order: true },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });
    if (!instance) return apiError(404, "NOT_FOUND", "Template instance not found.");
    if (instance.request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (instance.request.status !== "DRAFT") return apiError(409, "CONFLICT", "Cannot modify defaults after request is sent.");
    if (instance.template.type !== "DOCUMENT") return apiError(400, "BAD_REQUEST", "Instance is not a document template.");

    const defaults = parseSigningDefaults(instance.template.docSigningDefaultsJson);
    if (defaults.length === 0) return apiSuccess({ ok: true, created: 0 });

    const roleMapInput = parsedBody.data.recipientRoleMap;
    const recipients = instance.request.recipients;
    if (recipients.length === 0) {
      return apiError(400, "NO_RECIPIENTS", "Add recipients before applying signing defaults.");
    }

    const recipientByRole = new Map<string, string>();
    for (const [role, recipientId] of Object.entries(roleMapInput)) {
      const exists = recipients.some((recipient) => recipient.id === recipientId);
      if (exists) recipientByRole.set(role, recipientId);
    }

    // If some roles were not mapped explicitly, map in sequential order.
    const uniqueRoles = Array.from(new Set(defaults.map((item) => item.role)));
    let recipientIndex = 0;
    for (const role of uniqueRoles) {
      if (recipientByRole.has(role)) continue;
      const fallback = recipients[Math.min(recipientIndex, recipients.length - 1)];
      recipientByRole.set(role, fallback.id);
      recipientIndex += 1;
    }

    await db.docSignField.deleteMany({ where: { requestId: instance.requestId } });
    if (defaults.length > 0) {
      await db.docSignField.createMany({
        data: defaults.map((field) => ({
          requestId: instance.requestId,
          recipientId: recipientByRole.get(field.role)!,
          type: field.type,
          page: field.page,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          required: field.required ?? true,
          options: field.options && field.options.length > 0 ? JSON.stringify(field.options) : null,
        })),
      });
    }

    await db.docSignAuditLog.create({
      data: {
        requestId: instance.requestId,
        event: "SIGNING_DEFAULTS_APPLIED",
        metadata: JSON.stringify({
          templateId: instance.templateId,
          templateVersion: instance.templateVersion,
          instanceId: instance.id,
          created: defaults.length,
        }),
      },
    });

    return apiSuccess({ ok: true, created: defaults.length });
  } catch (err) {
    console.error("[document-templates/apply-signing-defaults]", err);
    return apiError(500, "SERVER_ERROR", "Failed to apply signing defaults.");
  }
}
