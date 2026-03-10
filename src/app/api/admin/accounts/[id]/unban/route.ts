import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const user = await db.user.update({
    where: { id: params.id },
    data: { bannedAt: null, banReason: null },
    select: { id: true, bannedAt: true },
  });

  await writeAuditLog({
    event: "ADMIN_UNBAN",
    agentId: auth.adminId,
    metadata: { targetUserId: params.id },
  });

  return NextResponse.json(user);
}
