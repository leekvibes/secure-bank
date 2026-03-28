import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/schemas";
import { generateSlug } from "@/lib/tokens";
import { sendEmailVerification, sendNewSignupNotification } from "@/lib/email";
import { randomBytes } from "crypto";

function prismaErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const maybeCode = (err as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : null;
}

function isUniqueConstraintError(err: unknown): boolean {
  return prismaErrorCode(err) === "P2002";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const first = Object.values(errors).flat()[0];
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const { email, password, displayName } = parsed.data;

    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const normalizedEmail = email.toLowerCase().trim();
    let created = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await db.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            displayName,
            agentSlug: generateSlug(displayName),
            onboardingCompleted: false,
          },
        });
        created = true;
        break;
      } catch (createErr) {
        if (!isUniqueConstraintError(createErr)) throw createErr;
      }
    }

    if (!created) {
      return NextResponse.json(
        { error: "Could not create account. Please try again." },
        { status: 409 }
      );
    }

    // Create email verification token and send verification email
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const verifyToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await db.emailVerificationToken.create({
        data: { token: verifyToken, userId: user.id, expiresAt },
      });
      const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verifyToken}`;
      sendEmailVerification({
        toEmail: normalizedEmail,
        firstName: displayName.split(" ")[0],
        verifyUrl,
        expiresIn: "24 hours",
      });
      sendNewSignupNotification({
        newUserEmail: normalizedEmail,
        newUserName: displayName,
        signedUpAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
