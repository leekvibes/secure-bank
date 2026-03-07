import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/schemas";
import { generateSlug } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const first = Object.values(errors).flat()[0];
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const { email, password, displayName, agencyName, industry, destinationLabel } = parsed.data;

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
    const agentSlug = generateSlug(displayName);

    await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName,
        agencyName: agencyName ?? null,
        agentSlug,
        industry: industry ?? null,
        destinationLabel: destinationLabel ?? null,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
