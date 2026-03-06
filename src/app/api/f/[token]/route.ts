import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { SENSITIVE_FIELD_TYPES, type FormFieldType } from "@/lib/schemas";
import { addDays } from "date-fns";
import {
  ensureLegacyLogoAsset,
  selectAssetsForToken,
  toAssetRenderEntry,
} from "@/lib/asset-library";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isValidSingleUseToken } from "@/lib/validation";
import { validateDynamicSubmission } from "@/lib/form-submission-validation";
import { writeAuditLog } from "@/lib/audit";

// GET — public: return form config for client rendering
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`form:view:${params.token}:${ip}`);
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes.");
  }

  const link = await db.formLink.findUnique({
    where: { token: params.token },
    include: {
      assets: {
        orderBy: { order: "asc" },
        include: { asset: true },
      },
      form: {
        include: {
          fields: { orderBy: { order: "asc" } },
          agent: {
            select: {
              displayName: true,
              agencyName: true,
              company: true,
              industry: true,
              logoUrl: true,
              destinationLabel: true,
              licenseNumber: true,
              verificationStatus: true,
            },
          },
        },
      },
    },
  });

  if (!link) {
    return apiError(404, "LINK_NOT_FOUND", "Not found.");
  }

  await ensureLegacyLogoAsset(link.form.agentId);

  const existingSubmission = await db.formSubmission.findUnique({
    where: { formLinkId: link.id },
    select: { id: true },
  });
  const tokenState = isValidSingleUseToken(
    link.expiresAt,
    link.status,
    Boolean(existingSubmission)
  );
  if (!tokenState.ok) {
    return apiError(
      tokenState.code === "expired" ? 410 : 409,
      tokenState.code === "expired" ? "LINK_EXPIRED" : "LINK_ALREADY_USED",
      tokenState.message
    );
  }

  // Mark as opened
  if (link.status === "CREATED") {
    await db.formLink.update({ where: { id: link.id }, data: { status: "OPENED" } });
    await writeAuditLog({
      event: "FORM_OPENED",
      agentId: link.form.agentId,
      request: req,
      metadata: { formId: link.formId, formLinkId: link.id, via: "api" },
    });
  }

  const fields = link.form.fields.map((f) => ({
    id: f.id,
    label: f.label,
    fieldType: f.fieldType,
    placeholder: f.placeholder,
    helpText: f.helpText,
    required: f.required,
    maskInput: f.maskInput,
    confirmField: f.confirmField,
    dropdownOptions: f.dropdownOptions ? JSON.parse(f.dropdownOptions) : null,
  }));

  const fallbackAssets = await db.agentAsset.findMany({
    where: { userId: link.form.agentId, type: "LOGO" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  const selectedAssets = selectAssetsForToken(
    link.assets.map((entry) => entry.asset),
    fallbackAssets
  );

  const assetPayload = (
    await Promise.all(selectedAssets.map((asset) => toAssetRenderEntry(asset)))
  ).filter((asset) => asset.url && asset.mimeType.startsWith("image/"));
  const logoUrls = assetPayload
    .map((asset) => asset.url)
    .filter((url): url is string => Boolean(url));
  if (logoUrls.length === 0 && link.form.agent.logoUrl) {
    logoUrls.push(link.form.agent.logoUrl);
  }

  const resolvedLogoUrl = logoUrls[0] ?? link.form.agent.logoUrl ?? null;

  return apiSuccess({
    form: {
      title: link.form.title,
      description: link.form.description,
    },
    fields,
    agent: {
      ...link.form.agent,
      logoUrl: resolvedLogoUrl,
    },
    assets: assetPayload,
    logoUrls,
    link: {
      destinationLabel: link.destinationLabel ?? link.destination,
      messageTemplate: link.messageTemplate,
      options: link.optionsJson ? JSON.parse(link.optionsJson) : {},
      clientName: link.clientName,
      expiresAt: link.expiresAt.toISOString(),
    },
  });
}

// POST — public: submit the form
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`form:submit:${params.token}:${ip}`);
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes.");
  }

  const link = await db.formLink.findUnique({
    where: { token: params.token },
    include: {
      form: {
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!link) return apiError(404, "LINK_NOT_FOUND", "Not found.");
  if (link.form.status !== "ACTIVE") {
    return apiError(409, "FORM_INACTIVE", "This form is no longer accepting submissions.");
  }

  // Check no existing submission
  const existing = await db.formSubmission.findUnique({ where: { formLinkId: link.id } });
  const tokenState = isValidSingleUseToken(link.expiresAt, link.status, Boolean(existing));
  if (!tokenState.ok) {
    return apiError(
      tokenState.code === "expired" ? 410 : 409,
      tokenState.code === "expired" ? "LINK_EXPIRED" : "LINK_ALREADY_USED",
      tokenState.message
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError(400, "INVALID_JSON", "Invalid request body.");
  }

  const { values: validatedValues, fieldErrors } = validateDynamicSubmission(
    link.form.fields,
    body as Record<string, unknown>,
    (fieldType) => SENSITIVE_FIELD_TYPES.includes(fieldType as FormFieldType)
  );

  if (Object.keys(fieldErrors).length > 0) {
    return apiError(422, "VALIDATION_ERROR", "Please fix the errors below.", {
      fieldErrors,
    });
  }

  if (validatedValues.length === 0) {
    return apiError(400, "EMPTY_SUBMISSION", "No values submitted.");
  }

  const values = validatedValues.map((value) => ({
    ...value,
    value: value.isEncrypted ? encrypt(value.value) : value.value,
  }));

  const deleteAt = addDays(new Date(), link.form.retentionDays > 0 ? link.form.retentionDays : 3650);

  await db.$transaction([
    db.formSubmission.create({
      data: {
        formLinkId: link.id,
        formId: link.form.id,
        deleteAt,
        values: {
          create: values,
        },
      },
    }),
    db.formLink.update({
      where: { id: link.id },
      data: { status: "SUBMITTED" },
    }),
  ]);

  await writeAuditLog({
    event: "FORM_SUBMITTED",
    agentId: link.form.agentId,
    request: req,
    metadata: { formId: link.formId, formLinkId: link.id },
  });

  return apiSuccess({ success: true }, 201);
}
