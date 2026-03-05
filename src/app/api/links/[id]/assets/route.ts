import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { NO_STORE_HEADERS } from "@/lib/http";
import { assertAssetOwnership } from "@/lib/asset-library";
import { z } from "zod";

const schema = z.object({
  assetIds: z.array(z.string().min(1)).max(10),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const link = await db.secureLink.findFirst({
    where: { id: params.id, agentId: session.user.id },
    select: { id: true },
  });
  if (!link) {
    return NextResponse.json(
      { error: "Link not found." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const uniqueAssetIds = Array.from(new Set(parsed.data.assetIds));

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

  await db.$transaction([
    db.secureLinkAsset.deleteMany({ where: { secureLinkId: link.id } }),
    ...uniqueAssetIds.map((assetId, index) =>
      db.secureLinkAsset.create({
        data: {
          secureLinkId: link.id,
          assetId,
          order: index,
        },
      })
    ),
  ]);

  return NextResponse.json(
    { success: true, count: uniqueAssetIds.length },
    { headers: NO_STORE_HEADERS }
  );
}

