import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { encode } from "next-auth/jwt";
import {
  getNextAuthCookieOptions,
  getSessionCookieName,
} from "@/lib/auth/options";
import { sendSignInAlertEmail } from "@/lib/email";

const SESSION_COOKIE = getSessionCookieName();

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.displayName,
        agentSlug: user.agentSlug,
        role: user.role,
        sub: user.id,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 8 * 60 * 60,
    });

    // Send sign-in alert — fire and forget
    const ua = req.headers.get("user-agent") ?? "Unknown device";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    sendSignInAlertEmail({
      toEmail: user.email,
      toName: user.displayName.split(" ")[0],
      time: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
      browser: ua,
      ipApprox: ip,
    }).catch(() => {});

    const response = NextResponse.json({ success: true });

    const cookieOptions = {
      ...getNextAuthCookieOptions(),
      maxAge: 8 * 60 * 60,
    };

    response.cookies.set(SESSION_COOKIE, token, cookieOptions);

    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
