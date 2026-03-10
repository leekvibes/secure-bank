import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      company: true,
      agencyName: true,
      industry: true,
      phone: true,
      licenseNumber: true,
      verificationStatus: true,
      role: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { links: true, idUploads: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [recentLinks, auditLogs, submissionCount, lastActive] = await Promise.all([
    db.secureLink.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, linkType: true, status: true, createdAt: true, submittedAt: true, clientName: true },
    }),
    db.auditLog.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, event: true, ipAddress: true, createdAt: true, metadata: true },
    }),
    db.submission.count({ where: { link: { agentId: params.id } } }),
    db.auditLog.findFirst({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return NextResponse.json({ user, recentLinks, auditLogs, submissionCount, lastActive: lastActive?.createdAt ?? null });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const allowed = ["UNVERIFIED", "LICENSED", "CERTIFIED", "REGULATED"];
  if (!allowed.includes(body.verificationStatus)) {
    return NextResponse.json({ error: "Invalid verificationStatus" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: params.id },
    data: { verificationStatus: body.verificationStatus },
    select: { id: true, verificationStatus: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  // Prevent self-deletion
  if (params.id === auth.adminId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Write audit log before deletion so the record persists
  await writeAuditLog({
    event: "ADMIN_DELETE_ACCOUNT",
    agentId: auth.adminId,
    metadata: { deletedUserId: params.id },
  });

  await db.user.delete({ where: { id: params.id } });

  return new NextResponse(null, { status: 204 });
}
