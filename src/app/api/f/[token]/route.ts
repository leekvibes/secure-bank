import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { SENSITIVE_FIELD_TYPES, type FormFieldType } from "@/lib/schemas";
import { isExpired } from "@/lib/utils";
import { addDays } from "date-fns";

// GET — public: return form config for client rendering
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const link = await db.formLink.findUnique({
    where: { token: params.token },
    include: {
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

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isExpired(link.expiresAt) || link.status === "EXPIRED") {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (link.status === "SUBMITTED") {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  // Mark as opened
  if (link.status === "CREATED") {
    await db.formLink.update({ where: { id: link.id }, data: { status: "OPENED" } });
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

  return NextResponse.json({
    form: {
      title: link.form.title,
      description: link.form.description,
    },
    fields,
    agent: link.form.agent,
    link: {
      clientName: link.clientName,
      expiresAt: link.expiresAt.toISOString(),
    },
  });
}

// POST — public: submit the form
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const link = await db.formLink.findUnique({
    where: { token: params.token },
    include: {
      form: {
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isExpired(link.expiresAt) || link.status === "EXPIRED") {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }
  if (link.status === "SUBMITTED") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  // Check no existing submission
  const existing = await db.formSubmission.findUnique({ where: { formLinkId: link.id } });
  if (existing) return NextResponse.json({ error: "Already submitted." }, { status: 409 });

  const body = await req.json();
  const values: {
    fieldId: string;
    fieldLabel: string;
    value: string;
    isEncrypted: boolean;
  }[] = [];

  // Validate + collect values
  const fieldErrors: Record<string, string> = {};

  for (const field of link.form.fields) {
    const rawValue = body[field.id] ?? "";
    const value = String(rawValue).trim();

    if (field.required && !value) {
      fieldErrors[field.id] = `${field.label} is required.`;
      continue;
    }

    if (!value) continue; // Optional + empty — skip

    // Validate confirm field pair
    if (field.confirmField) {
      const confirmValue = String(body[`confirm_${field.id}`] ?? "").trim();
      const normalize = (v: string) => v.replace(/\D/g, "");
      const isSensitive = SENSITIVE_FIELD_TYPES.includes(field.fieldType as FormFieldType);
      const a = isSensitive ? normalize(value) : value;
      const b = isSensitive ? normalize(confirmValue) : confirmValue;
      if (a !== b) {
        fieldErrors[`confirm_${field.id}`] = `${field.label} values do not match.`;
      }
    }

    // Determine encryption
    const isSensitive = SENSITIVE_FIELD_TYPES.includes(field.fieldType as FormFieldType);
    const shouldEncrypt = isSensitive || field.encrypted;

    values.push({
      fieldId: field.id,
      fieldLabel: field.label,
      value: shouldEncrypt ? encrypt(value) : value,
      isEncrypted: shouldEncrypt,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "Please fix the errors below.", fieldErrors }, { status: 422 });
  }

  if (values.length === 0) {
    return NextResponse.json({ error: "No values submitted." }, { status: 400 });
  }

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

  return NextResponse.json({ success: true }, { status: 201 });
}
