import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership before deleting
  const link = await db.secureLink.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });

  if (!link) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    event: "DELETED",
    agentId: session.user.id,
    linkId: link.id,
    request: req,
    metadata: { linkType: link.linkType, status: link.status },
  });

  // Cascade deletes submission + audit log link references (via Prisma schema)
  await db.secureLink.delete({ where: { id: link.id } });

  return NextResponse.json({ success: true });
}
