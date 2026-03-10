import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  if (params.id === auth.adminId) {
    return NextResponse.json({ error: "Cannot ban your own account" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string = body.reason?.trim() || "Violation of terms of service";

  const user = await db.user.update({
    where: { id: params.id },
    data: { bannedAt: new Date(), banReason: reason },
    select: { id: true, bannedAt: true, banReason: true },
  });

  await writeAuditLog({
    event: "ADMIN_BAN",
    agentId: auth.adminId,
    metadata: { targetUserId: params.id, reason },
  });

  return NextResponse.json(user);
}
