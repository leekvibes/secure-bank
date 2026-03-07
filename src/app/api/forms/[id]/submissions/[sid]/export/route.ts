import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { NO_STORE_HEADERS } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; sid: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`form-export:${params.sid}:${session.user.id}:${ip}`);
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes.");
  }

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
    select: { title: true },
  });
  if (!form) {
    return apiError(404, "NOT_FOUND", "Form not found.");
  }

  const submission = await db.formSubmission.findFirst({
    where: { id: params.sid, formId: params.id },
    include: {
      formLink: { select: { clientName: true, clientEmail: true, clientPhone: true } },
      values: {
        include: { field: { select: { fieldType: true } } },
        orderBy: { field: { order: "asc" } },
      },
    },
  });

  if (!submission) {
    return apiError(404, "NOT_FOUND", "Submission not found.");
  }

  const format = req.nextUrl.searchParams.get("format") ?? "json";

  const fields: Record<string, string> = {};
  for (const v of submission.values) {
    if (v.field.fieldType === "signature") {
      fields[v.fieldLabel] = "[signature data]";
      continue;
    }
    try {
      fields[v.fieldLabel] = v.isEncrypted ? decrypt(v.value) : v.value;
    } catch {
      fields[v.fieldLabel] = "[decryption error]";
    }
  }

  const formLinks = await db.formLink.findMany({
    where: { formId: params.id },
    select: { id: true },
    take: 1,
  });
  const linkId = formLinks[0]?.id;

  await writeAuditLog({
    event: "EXPORTED",
    agentId: session.user.id,
    linkId: linkId ?? undefined,
    request: req,
    metadata: { format, formId: params.id, submissionId: params.sid },
  });

  const clientName = submission.formLink.clientName ?? "Anonymous";

  if (format === "text") {
    const lines = [
      `SECURE FORM SUBMISSION EXPORT`,
      `==============================`,
      `Form:      ${form.title}`,
      `Client:    ${clientName}`,
      ...(submission.formLink.clientEmail ? [`Email:     ${submission.formLink.clientEmail}`] : []),
      ...(submission.formLink.clientPhone ? [`Phone:     ${submission.formLink.clientPhone}`] : []),
      `Submitted: ${submission.createdAt.toISOString()}`,
      `Exported:  ${new Date().toISOString()}`,
      ``,
      `FIELDS`,
      `------`,
      ...Object.entries(fields).map(
        ([key, val]) => `${key.padEnd(28)}: ${val}`
      ),
      ``,
      `This export contains sensitive information. Handle according to your`,
      `data handling policies. Do not share or store insecurely.`,
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="form-submission-${params.sid.slice(0, 8)}.txt"`,
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    submissionId: submission.id,
    formTitle: form.title,
    clientName,
    clientEmail: submission.formLink.clientEmail ?? null,
    clientPhone: submission.formLink.clientPhone ?? null,
    submittedAt: submission.createdAt.toISOString(),
    fields,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="form-submission-${params.sid.slice(0, 8)}.json"`,
    },
  });
}
