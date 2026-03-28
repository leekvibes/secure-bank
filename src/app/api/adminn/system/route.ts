import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers, totalLinks, totalSubmissions, totalForms, totalTransfers,
    recentUsers, expiredLinksNotCleaned, pendingVerifications,
  ] = await Promise.all([
    db.user.count(),
    db.secureLink.count(),
    db.submission.count(),
    db.form.count(),
    db.fileTransfer.count(),
    db.user.count({ where: { createdAt: { gte: oneDayAgo } } }),
    db.secureLink.count({ where: { expiresAt: { lt: now }, submittedAt: null, status: { notIn: ["EXPIRED", "SUBMITTED"] } } }),
    db.user.count({ where: { emailVerified: false, role: "AGENT", createdAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } } }),
  ]);

  return NextResponse.json({
    db: { users: totalUsers, links: totalLinks, submissions: totalSubmissions, forms: totalForms, transfers: totalTransfers, recentUsers },
    health: {
      stripe: isStripeConfigured() ? "configured" : "missing",
      expiredLinksNotCleaned,
      pendingVerifications,
    },
    env: {
      stripe: isStripeConfigured(),
      resend: !!process.env.RESEND_API_KEY,
      twilio: !!process.env.TWILIO_ACCOUNT_SID,
      cronSecret: !!process.env.CRON_SECRET,
      nextauthUrl: process.env.NEXTAUTH_URL ?? null,
    },
    timestamp: now.toISOString(),
  });
}
