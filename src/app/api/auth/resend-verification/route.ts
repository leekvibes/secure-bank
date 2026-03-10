import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendEmailVerification } from "@/lib/email";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// Simple in-memory cooldown map (per userId, 60s window)
const cooldowns = new Map<string, number>();

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Enforce 60-second cooldown
  const lastSent = cooldowns.get(userId) ?? 0;
  const elapsed = Date.now() - lastSent;
  if (elapsed < 60_000) {
    const waitSecs = Math.ceil((60_000 - elapsed) / 1000);
    return NextResponse.json(
      { error: `Please wait ${waitSecs} seconds before resending.` },
      { status: 429 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, emailVerified: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ alreadyVerified: true });

  // Invalidate old tokens (mark used) and create a new one
  await db.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.emailVerificationToken.create({
    data: { token, userId, expiresAt },
  });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
  sendEmailVerification({
    toEmail: user.email,
    firstName: user.displayName.split(" ")[0],
    verifyUrl,
    expiresIn: "24 hours",
  });

  cooldowns.set(userId, Date.now());
  return NextResponse.json({ success: true });
}
