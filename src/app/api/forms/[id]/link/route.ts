import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { createFormLinkSchema } from "@/lib/schemas";
import { generateToken } from "@/lib/tokens";
import { addHours } from "date-fns";
import { assertAssetOwnership } from "@/lib/asset-library";
import { NO_STORE_HEADERS } from "@/lib/http";
import { getPlan } from "@/lib/plans";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id, status: "ACTIVE" },
  });
  if (!form) {
    return NextResponse.json(
      { error: "Form not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const userPlan = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const planConfig = getPlan(userPlan?.plan ?? "FREE");
  if (!planConfig.canUseForms) {
    return NextResponse.json(
      { error: "Custom forms are available on Pro and Agency plans. Upgrade to unlock." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const body = await req.json();
  const parsed = createFormLinkSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json(
      { error: first ?? "Invalid input" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const { destination, clientName, clientPhone, clientEmail, expirationHours, assetIds } = parsed.data;

  const token = generateToken();
  const expiresAt = addHours(new Date(), expirationHours);

  const uniqueAssetIds = Array.from(new Set(assetIds));
  if (uniqueAssetIds.length > 0) {
    const owned = await db.agentAsset.findMany({
      where: { userId: session.user.id, id: { in: uniqueAssetIds } },
      select: { id: true },
    });
    try {
      assertAssetOwnership(
        owned.map((a) => a.id),
        uniqueAssetIds
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid assets." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
  }

  const link = await db.formLink.create({
    data: {
      formId: form.id,
      token,
      destination: destination?.trim() || null,
      clientName: clientName || null,
      clientPhone: clientPhone || null,
      clientEmail: clientEmail || null,
      expiresAt,
      assets:
        uniqueAssetIds.length > 0
          ? {
              create: uniqueAssetIds.map((assetId, order) => ({
                assetId,
                order,
              })),
            }
          : undefined,
    },
  });

  const baseUrl = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}/f/${token}`;

  const clientPart = clientName ? `Hi ${clientName.split(" ")[0]}, ` : "";
  const messageText = `${clientPart}Please fill out this secure form for ${form.title}. Your information is encrypted and goes directly to your agent:\n\n${url}\n\nLet me know once you've submitted it.`;

  return NextResponse.json(
    { id: link.id, token, url, messageText, expiresAt: expiresAt.toISOString() },
    { status: 201, headers: NO_STORE_HEADERS }
  );
}
