import { NextRequest, NextResponse } from "next/server";
import { lookupLocal } from "@/lib/routing-numbers";

export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get("number");
  if (!number || !/^\d{9}$/.test(number)) {
    return NextResponse.json({ name: null }, { status: 200 });
  }

  const localName = lookupLocal(number);
  if (localName) {
    return NextResponse.json({ name: localName });
  }

  try {
    const res = await fetch(
      `https://www.routingnumbers.info/api/name.json?rn=${number}`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(3000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ name: null });
    }

    const data = await res.json();
    if (data.code === 200 && data.name) {
      return NextResponse.json({ name: data.name });
    }

    return NextResponse.json({ name: null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
