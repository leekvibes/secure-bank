import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listRequestRows } from "@/lib/requests";
import { NO_STORE_HEADERS } from "@/lib/http";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const requests = await listRequestRows(session.user.id);
  return NextResponse.json({ requests }, { headers: NO_STORE_HEADERS });
}
