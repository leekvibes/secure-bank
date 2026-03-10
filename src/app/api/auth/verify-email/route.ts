import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies the user's email address and sends a welcome email.
 *
 * - If the user has an active session: redirect to /onboarding/profile
 * - If no session (clicked from another device): redirect to /auth?verified=1
 * - On failure: redirect to /auth?error=verify or ?error=verify-expired
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth?error=verify", req.url));
  }

  const record = await db.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record) {
    return NextResponse.redirect(new URL("/auth?error=verify", req.url));
  }

  if (record.usedAt) {
    // Already verified — send to onboarding if session, otherwise sign-in
    const session = await getServerSession(authOptions);
    if (session?.user?.id === record.userId) {
      return NextResponse.redirect(new URL("/onboarding/profile", req.url));
    }
    return NextResponse.redirect(new URL("/auth?verified=1", req.url));
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/auth?error=verify-expired", req.url));
  }

  // Mark verified
  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
    db.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Send welcome email (fire and forget)
  sendWelcomeEmail({
    toEmail: record.user.email,
    firstName: record.user.displayName.split(" ")[0],
  });

  // Redirect based on whether user has an active session
  const session = await getServerSession(authOptions);
  if (session?.user?.id === record.userId) {
    return NextResponse.redirect(new URL("/onboarding/profile", req.url));
  }
  return NextResponse.redirect(new URL("/auth?verified=1", req.url));
}
