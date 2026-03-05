import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/schemas";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return NextResponse.json({ error: first }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        displayName: parsed.data.displayName,
        agencyName: parsed.data.agencyName ?? null,
        phone: parsed.data.phone ?? null,
        licenseNumber: parsed.data.licenseNumber ?? null,
        licensedStates: parsed.data.licensedStates ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile/update]", err);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
}
