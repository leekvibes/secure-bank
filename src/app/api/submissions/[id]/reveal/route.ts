import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { decryptFields } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submission = await db.submission.findFirst({
    where: {
      id: params.id,
      link: { agentId: session.user.id }, // agent isolation
    },
    include: { link: true },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // View-once check: already revealed → refuse
  if (submission.link.viewOnce && submission.revealedAt !== null) {
    return NextResponse.json(
      {
        error:
          "View-once is enabled. This submission was already revealed and cannot be shown again.",
      },
      { status: 403 }
    );
  }

  // Decrypt
  let fields: Record<string, string>;
  try {
    const encryptedFields: Record<string, string> = JSON.parse(
      submission.encryptedData
    );
    fields = decryptFields(encryptedFields);
  } catch (err) {
    console.error("[reveal] Decryption error:", err);
    return NextResponse.json(
      { error: "Failed to decrypt submission." },
      { status: 500 }
    );
  }

  // Update reveal tracking
  const isFirstReveal = submission.revealedAt === null;
  await db.submission.update({
    where: { id: submission.id },
    data: {
      revealedAt: isFirstReveal ? new Date() : submission.revealedAt,
      revealCount: { increment: 1 },
    },
  });

  await writeAuditLog({
    event: submission.link.linkType === "SSN_ONLY" ? "SSN_REVEALED" : "REVEALED",
    agentId: session.user.id,
    linkId: submission.linkId,
    request: req,
    metadata: { submissionId: submission.id, revealCount: submission.revealCount + 1 },
  });

  return NextResponse.json({ fields });
}
