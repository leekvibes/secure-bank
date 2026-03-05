import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; sid: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const submission = await db.formSubmission.findFirst({
    where: { id: params.sid, formId: params.id },
    include: {
      formLink: { select: { clientName: true, clientEmail: true, clientPhone: true } },
      values: { include: { field: { select: { fieldType: true } } } },
    },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark as viewed
  if (!submission.viewedAt) {
    await db.formSubmission.update({
      where: { id: submission.id },
      data: { viewedAt: new Date() },
    });
  }

  // Decrypt encrypted values
  const values = submission.values.map((v) => ({
    fieldId: v.fieldId,
    fieldLabel: v.fieldLabel,
    fieldType: v.field.fieldType,
    value: v.isEncrypted ? decrypt(v.value) : v.value,
    isEncrypted: v.isEncrypted,
  }));

  return NextResponse.json({
    submission: {
      id: submission.id,
      createdAt: submission.createdAt,
      viewedAt: submission.viewedAt,
      deleteAt: submission.deleteAt,
      client: submission.formLink,
      values,
    },
  });
}
