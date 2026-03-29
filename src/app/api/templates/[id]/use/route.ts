import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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
