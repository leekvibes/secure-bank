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

    const d = parsed.data;
    await db.user.update({
      where: { id: session.user.id },
      data: {
        displayName: d.displayName,
        agencyName: d.agencyName ?? null,
        phone: d.phone ?? null,
        licenseNumber: d.licenseNumber ?? null,
        licensedStates: d.licensedStates ?? null,
        industry: d.industry ?? null,
        destinationLabel: d.destinationLabel ?? null,
        carriersList: d.carriersList ?? null,
        notificationEmail: d.notificationEmail || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile/update]", err);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
}
