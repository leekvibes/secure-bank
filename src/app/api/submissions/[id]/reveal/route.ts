import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { decryptFields } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { NO_STORE_HEADERS } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const submission = await db.submission.findFirst({
    where: { id: params.id, link: { agentId: session.user.id } },
    include: { link: true },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let fields: Record<string, string>;
  try {
    const encryptedFields: Record<string, string> = JSON.parse(submission.encryptedData);
    fields = decryptFields(encryptedFields);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt submission." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  // Track reveal count and first-reveal timestamp (for audit, not gating)
  const isFirstReveal = submission.revealedAt === null;
  await db.submission.update({
    where: { id: submission.id },
    data: {
      revealedAt: isFirstReveal ? new Date() : submission.revealedAt,
      revealCount: { increment: 1 },
    },
  });

  await writeAuditLog({
    event: "REVEALED",
    agentId: session.user.id,
    linkId: submission.linkId,
    request: req,
    metadata: { submissionId: submission.id, revealCount: submission.revealCount + 1 },
  });

  return NextResponse.json({ fields }, { headers: NO_STORE_HEADERS });
}
