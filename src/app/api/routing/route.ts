import { NextRequest, NextResponse } from "next/server";

/**
 * Routing number lookup proxy.
 * Uses the free routingnumbers.info API (no auth required).
 * We proxy this to avoid exposing third-party calls from the client directly.
 */
export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get("number");
  if (!number || !/^\d{9}$/.test(number)) {
    return NextResponse.json({ name: null }, { status: 200 });
  }

  try {
    // Using the free Federal Reserve routing number API
    const res = await fetch(
      `https://www.routingnumbers.info/api/name.json?rn=${number}`,
      {
        next: { revalidate: 86400 }, // cache 24 hours
        signal: AbortSignal.timeout(3000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ name: null });
    }

    const data = await res.json();
    // API returns { rn: "021000021", name: "JP MORGAN CHASE", message: "OK", code: 200 }
    if (data.code === 200 && data.name) {
      return NextResponse.json({ name: data.name });
    }

    return NextResponse.json({ name: null });
  } catch {
    // Silently fail — routing lookup is best-effort
    return NextResponse.json({ name: null });
  }
}
