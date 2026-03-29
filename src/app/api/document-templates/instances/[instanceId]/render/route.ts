import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  applyBlockOverrides,
  normalizeDocumentValues,
  parseDocumentTemplateSchema,
  resolveEnabledClauses,
} from "@/lib/document-templates/schema";
import { renderDocumentTemplatePdf } from "@/lib/document-templates/render";
import { processPdf } from "@/lib/signing/pdf-pipeline";
import { createHash } from "crypto";
import { z } from "zod";
import { isDocumentTemplatesEnabledServer } from "@/lib/feature-flags";

const bodySchema = z.object({
  values: z.record(z.unknown()).default({}),
  enabledClauseIds: z.array(z.string()).optional(),
  blockOverrides: z.record(z.unknown()).optional(),
});

// POST /api/document-templates/instances/[instanceId]/render
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
    if (!parsedBody.success) {
      return apiError(400, "VALIDATION_ERROR", "Invalid render payload.");
    }

    const instance = await db.documentTemplateInstance.findUnique({
      where: { id: params.instanceId },
      include: {
        template: true,
        request: {
          select: { id: true, agentId: true, status: true },
        },
      },
    });
    if (!instance) return apiError(404, "NOT_FOUND", "Template instance not found.");
    if (instance.request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (instance.request.status !== "DRAFT") return apiError(409, "CONFLICT", "Cannot render after request is sent.");
    if (instance.template.type !== "DOCUMENT") return apiError(400, "BAD_REQUEST", "Instance is not a document template.");

    const schema = parseDocumentTemplateSchema(instance.template.docSchemaJson);
    const { values, errors } = normalizeDocumentValues(schema, parsedBody.data.values);
    const clauseResolution = resolveEnabledClauses(schema, parsedBody.data.enabledClauseIds);
    const blockOverrideResult = applyBlockOverrides(schema, parsedBody.data.blockOverrides ?? {});
    const allErrors = [...errors, ...clauseResolution.errors, ...blockOverrideResult.errors];
    if (allErrors.length > 0) {
      return apiError(400, "VALIDATION_ERROR", allErrors[0], { errors: allErrors });
    }

    const rendered = await renderDocumentTemplatePdf(
      blockOverrideResult.schema,
      values,
      clauseResolution.enabledClauseIds,
    );
    const fileName = `${instance.template.title.replace(/[^a-zA-Z0-9._\- ]/g, "_")}_v${instance.template.docVersion}.pdf`;
    const processed = await processPdf(rendered, fileName);
    const renderHash = createHash("sha256").update(rendered).digest("hex");

    await db.$transaction([
      db.docSignPage.deleteMany({ where: { requestId: instance.requestId } }),
      db.docSignRequest.update({
        where: { id: instance.requestId },
        data: {
          blobUrl: processed.blobUrl,
          documentHash: processed.documentHash,
          originalName: fileName,
        },
      }),
      db.documentTemplateInstance.update({
        where: { id: instance.id },
        data: {
          resolvedValuesJson: JSON.stringify(values),
          enabledClausesJson: JSON.stringify(clauseResolution.enabledClauseIds),
          renderHash,
          renderedBlobUrl: processed.blobUrl,
        },
      }),
      ...processed.pages.map((page) =>
        db.docSignPage.create({
          data: {
            requestId: instance.requestId,
            page: page.page,
            widthPts: page.widthPts,
            heightPts: page.heightPts,
          },
        }),
      ),
      db.docSignAuditLog.create({
        data: {
          requestId: instance.requestId,
          event: "DOCUMENT_RENDERED",
          metadata: JSON.stringify({
            templateId: instance.templateId,
            templateVersion: instance.templateVersion,
            instanceId: instance.id,
            renderHash,
          }),
        },
      }),
    ]);

    return apiSuccess({
      ok: true,
      requestId: instance.requestId,
      blobUrl: processed.blobUrl,
      documentHash: processed.documentHash,
      pages: processed.pages,
    });
  } catch (err) {
    console.error("[document-templates/render]", err);
    return apiError(500, "SERVER_ERROR", "Failed to render document template.");
  }
}
