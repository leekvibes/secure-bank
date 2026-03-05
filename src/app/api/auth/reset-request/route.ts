import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { addHours } from "date-fns";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  // Always return 200 regardless — prevents email enumeration
  if (!parsed.success) {
    return NextResponse.json({ success: true });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  if (user) {
    // Invalidate any existing tokens for this user
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = generateToken();
    const expiresAt = addHours(new Date(), 1);

    await db.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const appUrl = process.env.NEXTAUTH_URL ?? "";
    const resetUrl = `${appUrl}/auth/reset?token=${token}`;

    await sendPasswordResetEmail({
      toEmail: user.email,
      toName: user.displayName,
      resetUrl,
    });
  }

  // Always 200 — don't reveal whether the email exists
  return NextResponse.json({ success: true });
}
