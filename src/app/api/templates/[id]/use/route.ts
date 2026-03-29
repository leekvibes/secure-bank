import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { canUseDocumentTemplates, getPlan } from "@/lib/plans";
import { generateToken } from "@/lib/tokens";
import { addHours } from "date-fns";
import { isDocumentTemplatesEnabledServer } from "@/lib/feature-flags";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const documentsEnabled = isDocumentTemplatesEnabledServer();
    const body = await req.json().catch(() => ({}));
    const titleOverride =
      typeof body?.titleOverride === "string" && body.titleOverride.trim()
        ? body.titleOverride.trim().slice(0, 160)
        : null;

    const template = await db.systemTemplate.findUnique({
      where: { id: params.id, isActive: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    // For FORM templates, check plan gating (forms are PRO+)
    if (template.type === "FORM") {
      const userPlan = await db.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      });
      const planConfig = getPlan(userPlan?.plan ?? "FREE");
      if (!planConfig.canUseForms) {
        return NextResponse.json(
          { error: "Custom forms are available on Pro and Agency plans. Upgrade to unlock.", code: "UPGRADE_REQUIRED" },
          { status: 403 }
        );
      }
    }

    if (template.type === "DOCUMENT") {
      if (!documentsEnabled) {
        return NextResponse.json({ error: "Document templates are currently disabled." }, { status: 404 });
      }
      const userPlan = await db.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      });
      if (!canUseDocumentTemplates(userPlan?.plan ?? "FREE")) {
        return NextResponse.json(
          { error: "Document templates are not available on your current plan.", code: "UPGRADE_REQUIRED" },
          { status: 403 }
        );
      }
      if (template.docStatus !== "PUBLISHED") {
        return NextResponse.json(
          { error: "This document template is not published yet." },
          { status: 409 }
        );
      }
    }

    // Record usage in both cases
    await db.$transaction([
      db.templateUsage.create({
        data: { templateId: template.id, agentId: session.user.id },
      }),
      db.systemTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    // SECURE_LINK — return the config so the UI can pre-fill /dashboard/new
    if (template.type === "SECURE_LINK") {
      return NextResponse.json({
        type: "link",
        linkType: template.linkType,
        optionsJson: template.optionsJson,
      });
    }

    // DOCUMENT — create a draft signing request and a template instance
    if (template.type === "DOCUMENT") {
      const created = await db.$transaction(async (tx) => {
        const request = await tx.docSignRequest.create({
          data: {
            token: generateToken(),
            title: titleOverride ?? template.title,
            message: template.description ?? null,
            status: "DRAFT",
            expiresAt: addHours(new Date(), 72),
            agentId: session.user.id,
            originalName: `${(titleOverride ?? template.title).replace(/[^a-zA-Z0-9._\- ]/g, "_")}.pdf`,
          },
          select: { id: true },
        });

        const instance = await tx.documentTemplateInstance.create({
          data: {
            templateId: template.id,
            requestId: request.id,
            templateVersion: template.docVersion ?? 1,
            resolvedValuesJson: template.docDefaultValuesJson ?? "{}",
            enabledClausesJson: "[]",
          },
          select: { id: true },
        });

        await tx.docSignAuditLog.create({
          data: {
            requestId: request.id,
            event: "TEMPLATE_SELECTED",
            metadata: JSON.stringify({
              templateId: template.id,
              templateVersion: template.docVersion ?? 1,
              instanceId: instance.id,
            }),
          },
        });

        return { requestId: request.id, templateInstanceId: instance.id };
      });

      return NextResponse.json({
        type: "document",
        requestId: created.requestId,
        templateInstanceId: created.templateInstanceId,
        templateId: template.id,
      });
    }

    // FORM — create the form with fields from the template
    const rawFields: Array<{
      label: string;
      fieldType: string;
      placeholder?: string;
      helpText?: string;
      required?: boolean;
      encrypted?: boolean;
      maskInput?: boolean;
      confirmField?: boolean;
      dropdownOptions?: string;
    }> = template.fieldsJson ? JSON.parse(template.fieldsJson) : [];

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { dataRetentionDays: true },
    });

    const form = await db.form.create({
      data: {
        title: template.title,
        description: template.description ?? null,
        retentionDays: user?.dataRetentionDays ?? 30,
        complianceGuarded: template.complianceGuarded,
        coreFieldLabels: template.coreFieldLabels ?? null,
        agentId: session.user.id,
        fields: {
          create: rawFields.map((f, idx) => ({
            label: f.label,
            fieldType: f.fieldType,
            placeholder: f.placeholder ?? null,
            helpText: f.helpText ?? null,
            required: f.required ?? false,
            encrypted: f.encrypted ?? false,
            maskInput: f.maskInput ?? false,
            confirmField: f.confirmField ?? false,
            dropdownOptions: f.dropdownOptions ?? null,
            order: idx,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ type: "form", formId: form.id });
  } catch (err) {
    console.error("[templates/use]", err);
    return NextResponse.json({ error: "Failed to apply template." }, { status: 500 });
  }
}
