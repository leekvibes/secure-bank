import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { createFormSchema } from "@/lib/schemas";
import { getPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Plan gating
    const userPlan = await db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } });
    const planConfig = getPlan(userPlan?.plan ?? "FREE");
    if (!planConfig.canUseForms) {
      return NextResponse.json(
        { error: "Custom forms are available on Pro and Agency plans. Upgrade to unlock.", code: "UPGRADE_REQUIRED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return NextResponse.json({ error: first ?? "Invalid input" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { dataRetentionDays: true },
    });

    const { title, description, retentionDays, fields } = parsed.data;
    const effectiveRetentionDays =
      retentionDays === undefined ? (user?.dataRetentionDays ?? 30) : retentionDays;

    const form = await db.form.create({
      data: {
        title,
        description: description ?? null,
        retentionDays: effectiveRetentionDays,
        agentId: session.user.id,
        fields: {
          create: fields.map((f, idx) => ({
            label: f.label,
            fieldType: f.fieldType,
            placeholder: f.placeholder ?? null,
            helpText: f.helpText ?? null,
            required: f.required,
            encrypted: f.encrypted,
            maskInput: f.maskInput,
            confirmField: f.confirmField,
            dropdownOptions: f.dropdownOptions ? JSON.stringify(f.dropdownOptions) : null,
            order: idx,
          })),
        },
      },
      include: { fields: true },
    });

    return NextResponse.json({ id: form.id }, { status: 201 });
  } catch (err) {
    console.error("[forms/create]", err);
    return NextResponse.json({ error: "Failed to create form." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const forms = await db.form.findMany({
      where: { agentId: session.user.id },
      include: {
        _count: { select: { fields: true, submissions: true, links: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ forms });
  } catch (err) {
    console.error("[forms/list]", err);
    return NextResponse.json({ error: "Failed to load forms." }, { status: 500 });
  }
}
