import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  bankingInfoSchema,
  ssnOnlySchema,
  fullIntakeSchema,
} from "@/lib/schemas";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { isExpired } from "@/lib/utils";
import { addDays } from "date-fns";
import { sendSubmissionNotification } from "@/lib/email";
import { NO_STORE_HEADERS } from "@/lib/http";
import { buildEncryptedSubmissionData } from "@/lib/submission-storage";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit by token (prevents repeated submissions / enumeration)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitKey = `submit:${params.token}:${ip}`;
  const { allowed } = await checkRateLimit(rateLimitKey);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 15 minutes." },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  // Fetch link + agent email for notification
  const link = await db.secureLink.findUnique({
    where: { token: params.token },
    include: { agent: { select: { email: true, displayName: true } } },
  });

  if (!link) {
    return NextResponse.json(
      { error: "Link not found." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  if (isExpired(link.expiresAt) || link.status === "EXPIRED") {
    return NextResponse.json(
      { error: "This link has expired." },
      { status: 410, headers: NO_STORE_HEADERS }
    );
  }

  // Prevent double submission
  const existing = await db.submission.findUnique({
    where: { linkId: link.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This link has already been submitted." },
      { status: 409, headers: NO_STORE_HEADERS }
    );
  }

  // Parse + validate
  let body: Record<string, string | boolean>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let validated: Record<string, string | boolean>;
  const schema =
    link.linkType === "BANKING_INFO"
      ? bankingInfoSchema
      : link.linkType === "SSN_ONLY"
      ? ssnOnlySchema
      : fullIntakeSchema;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(flat.fieldErrors)) {
      fieldErrors[k] = (v as string[])[0];
    }
    return NextResponse.json(
      { error: "Please fix the errors below.", fieldErrors },
      { status: 422, headers: NO_STORE_HEADERS }
    );
  }

  validated = parsed.data as unknown as Record<string, string | boolean>;

  const encryptedData = buildEncryptedSubmissionData(validated);
  const deleteAt = addDays(new Date(), link.retentionDays);

  // Store submission + update link status atomically
  await db.$transaction([
    db.submission.create({
      data: {
        linkId: link.id,
        encryptedData,
        deleteAt,
      },
    }),
    db.secureLink.update({
      where: { id: link.id },
      data: { status: "SUBMITTED" },
    }),
  ]);

  await writeAuditLog({
    event: "SUBMITTED",
    agentId: link.agentId,
    linkId: link.id,
    request: req,
  });

  // Fire-and-forget notification — never blocks the response
  const newSubmission = await db.submission.findUnique({
    where: { linkId: link.id },
    select: { id: true },
  });
  if (newSubmission) {
    sendSubmissionNotification({
      agentEmail: link.agent.email,
      agentName: link.agent.displayName,
      clientName: link.clientName,
      linkType: link.linkType,
      submissionId: newSubmission.id,
      appUrl: process.env.NEXTAUTH_URL ?? "",
    });
  }

  return NextResponse.json(
    { success: true },
    { status: 201, headers: NO_STORE_HEADERS }
  );
}
