import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies the user's email address and sends a welcome email.
 * Redirects to /auth?verified=1 on success, /auth?error=verify on failure.
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
    // Already verified — just redirect to sign in
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

  return NextResponse.redirect(new URL("/auth?verified=1", req.url));
}
