import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendTransferEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { createTransferSchema } from "@/lib/schemas";
import { getPlan } from "@/lib/plans";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } });
  const planConfig = getPlan(user?.plan ?? "FREE");
  if (!planConfig.canUseTransfers) {
    return apiError(403, "UPGRADE_REQUIRED", "File transfers are available on Pro and Agency plans. Upgrade to unlock.");
  }

  const transfers = await db.fileTransfer.findMany({
    where: { agentId: session.user.id },
    include: { files: { select: { id: true, fileName: true, sizeBytes: true, mimeType: true, downloadCount: true } } },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(transfers);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  // Plan gating
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } });
  const planConfig = getPlan(user?.plan ?? "FREE");
  if (!planConfig.canUseTransfers) {
    return apiError(403, "UPGRADE_REQUIRED", "File transfers are available on Pro and Agency plans. Upgrade to unlock.");
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Invalid request body.");
  }

  const parsed = createTransferSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return apiError(422, "VALIDATION_ERROR", "Invalid transfer data.", { fieldErrors });
  }
  const { title, message, viewOnce, expirationDays, notifyOnDownload, recipientEmails, files } = parsed.data;

  const MAX_TRANSFER_BYTES = BigInt(10 * 1024 * 1024 * 1024); // 10GB
  const totalBytes = files.reduce((sum, f) => sum + BigInt(f.sizeBytes), BigInt(0));
  if (totalBytes > MAX_TRANSFER_BYTES) {
    return apiError(400, "TRANSFER_TOO_LARGE", "Total transfer size exceeds 10 GB.");
  }

  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
  const token = generateToken();

  const transfer = await db.fileTransfer.create({
    data: {
      token,
      title: title?.trim() || null,
      message: message?.trim() || null,
      viewOnce,
      expiresAt,
      notifyOnDownload,
      totalSizeBytes: totalBytes,
      agentId: session.user.id,
      files: {
        create: files.map((f) => ({
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: BigInt(f.sizeBytes),
          blobUrl: f.blobUrl,
        })),
      },
    },
    include: { files: true },
  });

  await writeAuditLog({
    event: "TRANSFER_CREATED",
    agentId: session.user.id,
    request: req,
    metadata: { transferId: transfer.id, fileCount: files.length },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
  const transferUrl = `${appUrl}/t/${token}`;

  // Send email to each recipient
  if (recipientEmails && recipientEmails.length > 0) {
    const uniqueEmails = Array.from(new Set(recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    const agent = await db.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true, email: true },
    });
    for (const email of uniqueEmails) {
      sendTransferEmail({
        toEmail: email,
        agentName: agent?.displayName ?? "Someone",
        title: title || null,
        message: message || null,
        fileCount: files.length,
        totalSizeBytes: Number(totalBytes),
        transferUrl,
        expiresAt,
        viewOnce,
      });
    }
  }

  return apiSuccess({ id: transfer.id, token, url: transferUrl }, 201);
}
