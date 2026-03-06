import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptAndSaveFile } from "@/lib/files";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { isExpired } from "@/lib/utils";
import { addDays } from "date-fns";
import { NO_STORE_HEADERS } from "@/lib/http";
import { sendSubmissionNotification } from "@/lib/email";
import { validateUploadFile } from "@/lib/upload-security";

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const { allowed } = await checkRateLimit(`id-upload:${token}:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 15 minutes." },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const link = await db.secureLink.findUnique({
    where: { token },
    include: { agent: { select: { email: true, displayName: true } } },
  });

  if (!link || link.linkType !== "ID_UPLOAD") {
    return NextResponse.json({ error: "Invalid link." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  if (isExpired(link.expiresAt) || link.status === "EXPIRED") {
    return NextResponse.json({ error: "This link has expired." }, { status: 410, headers: NO_STORE_HEADERS });
  }

  const existing = await db.idUpload.findUnique({ where: { linkId: link.id } });
  if (existing) {
    return NextResponse.json({ error: "Already uploaded." }, { status: 409, headers: NO_STORE_HEADERS });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const frontFile = formData.get("front");
  const backFile = formData.get("back");

  if (!frontFile || typeof frontFile === "string") {
    return NextResponse.json({ error: "Front ID image is required." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const frontValidation = validateUploadFile(frontFile);
  if (!frontValidation.ok) {
    return NextResponse.json(
      { error: frontValidation.error ?? "Invalid front file." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const frontBytes = await frontFile.arrayBuffer();

  // Encrypt and save front
  const frontFilePath = await encryptAndSaveFile(Buffer.from(frontBytes));

  // Back is optional
  let backFilePath: string | undefined;
  if (backFile && typeof backFile !== "string") {
    const backValidation = validateUploadFile(backFile);
    if (!backValidation.ok) {
      return NextResponse.json(
        { error: backValidation.error ?? "Invalid back file." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const backBytes = await backFile.arrayBuffer();
    backFilePath = await encryptAndSaveFile(Buffer.from(backBytes));
  }

  const deleteAt = addDays(new Date(), link.retentionDays);

  await db.$transaction([
    db.idUpload.create({
      data: {
        linkId: link.id,
        agentId: link.agentId,
        frontFilePath,
        frontOriginalName: frontFile.name || null,
        frontMimeType: frontFile.type || null,
        backFilePath: backFilePath ?? null,
        backOriginalName:
          backFile && typeof backFile !== "string" ? backFile.name || null : null,
        backMimeType:
          backFile && typeof backFile !== "string" ? backFile.type || null : null,
        deleteAt,
      },
    }),
    db.secureLink.update({
      where: { id: link.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    event: "ID_UPLOADED",
    agentId: link.agentId,
    linkId: link.id,
    request: req,
  });

  // Fire-and-forget notification
  sendSubmissionNotification({
    agentEmail: link.agent.email,
    agentName: link.agent.displayName,
    clientName: link.clientName,
    linkType: "ID_UPLOAD",
    submissionId: link.id,
    appUrl: process.env.NEXTAUTH_URL ?? "",
  });

  return NextResponse.json({ success: true }, { status: 201, headers: NO_STORE_HEADERS });
}
