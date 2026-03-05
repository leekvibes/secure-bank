import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { decryptFields } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { LINK_TYPES } from "@/lib/utils";
import { NO_STORE_HEADERS } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`export:${params.id}:${session.user.id}:${ip}`);
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes.");
  }

  const format = req.nextUrl.searchParams.get("format") ?? "json";

  const submission = await db.submission.findFirst({
    where: { id: params.id, link: { agentId: session.user.id } },
    include: { link: true },
  });

  if (!submission) {
    return apiError(404, "NOT_FOUND", "Not found.");
  }

  let fields: Record<string, string>;
  try {
    const encrypted: Record<string, string> = JSON.parse(submission.encryptedData);
    fields = decryptFields(encrypted);
  } catch {
    return apiError(500, "DECRYPTION_FAILED", "Failed to decrypt.");
  }

  await writeAuditLog({
    event: "EXPORTED",
    agentId: session.user.id,
    linkId: submission.linkId,
    request: req,
    metadata: { format },
  });

  const linkTypeLabel =
    LINK_TYPES[submission.link.linkType as keyof typeof LINK_TYPES] ??
    submission.link.linkType;

  if (format === "text") {
    const lines = [
      `SECURE SUBMISSION EXPORT`,
      `========================`,
      `Type:      ${linkTypeLabel}`,
      `Client:    ${submission.link.clientName ?? "—"}`,
      `Submitted: ${submission.createdAt.toISOString()}`,
      `Exported:  ${new Date().toISOString()}`,
      ``,
      `FIELDS`,
      `------`,
      ...Object.entries(fields).map(
        ([key, val]) =>
          `${key.replace(/([A-Z])/g, " $1").trim().padEnd(24)}: ${val}`
      ),
      ``,
      `This export contains sensitive information. Handle according to your`,
      `data handling policies. Do not share or store insecurely.`,
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="submission-${params.id.slice(0, 8)}.txt"`,
      },
    });
  }

  // JSON export (default)
  const payload = {
    exportedAt: new Date().toISOString(),
    submissionId: submission.id,
    linkType: linkTypeLabel,
    clientName: submission.link.clientName,
    submittedAt: submission.createdAt.toISOString(),
    fields,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="submission-${params.id.slice(0, 8)}.json"`,
    },
  });
}
