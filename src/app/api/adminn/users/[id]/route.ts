import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendPasswordResetEmail, sendAccountBannedEmail } from "@/lib/email";
import { generateToken } from "@/lib/tokens";

async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const u = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (u?.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, displayName: true, agencyName: true, company: true, plan: true,
      planOverride: true, planOverrideNote: true, planOverrideBy: true, planOverriddenAt: true,
      emailVerified: true, bannedAt: true, banReason: true, createdAt: true, updatedAt: true,
      stripeSubscriptionId: true, stripeCustomerId: true, role: true, industry: true,
      onboardingCompleted: true, verificationStatus: true,
      _count: { select: { links: true, forms: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [recentLinks, auditLogs] = await Promise.all([
    db.secureLink.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, linkType: true, status: true, createdAt: true, expiresAt: true },
    }),
    db.adminAuditLog.findMany({
      where: { targetId: params.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ user, recentLinks, auditLogs });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { action: string; value?: string; note?: string };
  const { action, value, note } = body;
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;

  const target = await db.user.findUnique({ where: { id: params.id }, select: { email: true, plan: true, bannedAt: true, emailVerified: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const adminUser = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true } });

  if (action === "PLAN_OVERRIDE") {
    const validPlans = ["FREE", "BEGINNER", "PRO", "AGENCY"];
    if (!value || !validPlans.includes(value)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    await db.user.update({
      where: { id: params.id },
      data: {
        plan: value,
        planOverride: value,
        planOverrideNote: note ?? null,
        planOverrideBy: session.user.id,
        planOverriddenAt: new Date(),
      },
    });

    await db.adminAuditLog.create({
      data: {
        adminId: session.user.id,
        adminEmail: adminUser?.email ?? "",
        action: "PLAN_OVERRIDE",
        targetId: params.id,
        targetEmail: target.email,
        oldValue: target.plan,
        newValue: value,
        note: note ?? null,
        ip,
      },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "CLEAR_OVERRIDE") {
    await db.user.update({
      where: { id: params.id },
      data: { planOverride: null, planOverrideNote: null, planOverrideBy: null, planOverriddenAt: null },
    });
    await db.adminAuditLog.create({
      data: { adminId: session.user.id, adminEmail: adminUser?.email ?? "", action: "CLEAR_OVERRIDE", targetId: params.id, targetEmail: target.email, ip },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "BAN") {
    const bannedUser = await db.user.findUnique({ where: { id: params.id }, select: { displayName: true } });
    await db.user.update({ where: { id: params.id }, data: { bannedAt: new Date(), banReason: note ?? "Admin action" } });
    await db.adminAuditLog.create({ data: { adminId: session.user.id, adminEmail: adminUser?.email ?? "", action: "BAN_USER", targetId: params.id, targetEmail: target.email, note: note ?? null, ip } });
    sendAccountBannedEmail({
      toEmail: target.email,
      toName: bannedUser?.displayName?.split(" ")[0] ?? "there",
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  if (action === "UNBAN") {
    await db.user.update({ where: { id: params.id }, data: { bannedAt: null, banReason: null } });
    await db.adminAuditLog.create({ data: { adminId: session.user.id, adminEmail: adminUser?.email ?? "", action: "UNBAN_USER", targetId: params.id, targetEmail: target.email, ip } });
    return NextResponse.json({ success: true });
  }

  if (action === "VERIFY_EMAIL") {
    await db.user.update({ where: { id: params.id }, data: { emailVerified: true } });
    await db.adminAuditLog.create({ data: { adminId: session.user.id, adminEmail: adminUser?.email ?? "", action: "VERIFY_EMAIL", targetId: params.id, targetEmail: target.email, ip } });
    return NextResponse.json({ success: true });
  }

  if (action === "RESET_PASSWORD") {
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.passwordResetToken.create({ data: { token: resetToken, userId: params.id, expiresAt } });
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/auth/reset?token=${resetToken}`;
    await sendPasswordResetEmail({
      toEmail: target.email,
      toName: target.email,
      resetUrl,
    }).catch(() => {});
    await db.adminAuditLog.create({ data: { adminId: session.user.id, adminEmail: adminUser?.email ?? "", action: "RESET_PASSWORD", targetId: params.id, targetEmail: target.email, ip } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
