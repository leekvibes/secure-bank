import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: {
      fields: { orderBy: { order: "asc" } },
      links: {
        orderBy: { createdAt: "desc" },
        include: { submission: { select: { id: true, viewedAt: true } } },
        take: 50,
      },
      _count: { select: { submissions: true } },
    },
  });

  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ form });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: { fields: true },
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const formData: Record<string, unknown> = {};
  for (const key of ["title", "description", "status", "retentionDays"] as const) {
    if (key in body) formData[key] = body[key];
  }

  if (Object.keys(formData).length > 0) {
    await db.form.update({ where: { id: params.id }, data: formData });
  }

  if (Array.isArray(body.fields)) {
    await db.$transaction(async (tx) => {
      const existingIds = form.fields.map((f) => f.id);
      const incomingIds = body.fields.filter((f: { id?: string }) => f.id).map((f: { id: string }) => f.id);
      const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

      if (toDelete.length > 0) {
        await tx.formField.deleteMany({ where: { id: { in: toDelete }, formId: params.id } });
      }

      for (let idx = 0; idx < body.fields.length; idx++) {
        const f = body.fields[idx];
        const fieldData = {
          label: f.label,
          fieldType: f.fieldType,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          required: f.required ?? false,
          encrypted: f.encrypted ?? true,
          maskInput: f.maskInput ?? false,
          confirmField: f.confirmField ?? false,
          dropdownOptions: f.dropdownOptions ? JSON.stringify(f.dropdownOptions) : null,
          order: idx,
        };

        if (f.id && existingIds.includes(f.id)) {
          await tx.formField.update({ where: { id: f.id }, data: fieldData });
        } else {
          await tx.formField.create({ data: { ...fieldData, formId: params.id } });
        }
      }
    });
  }

  const updated = await db.form.findFirst({
    where: { id: params.id },
    include: { fields: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ form: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`delete:form:${session.user.id}:${ip}`, {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
    prefix: "rate:delete",
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.form.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
