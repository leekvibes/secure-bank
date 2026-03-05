import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { NO_STORE_HEADERS } from "@/lib/http";
import { createAssetFromUpload, ensureLegacyLogoAsset } from "@/lib/asset-library";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  await ensureLegacyLogoAsset(session.user.id);

  const assets = await db.agentAsset.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ assets }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  await ensureLegacyLogoAsset(session.user.id);

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "File is required." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const type = String(formData.get("type") ?? "LOGO");
  const name = String(formData.get("name") ?? "");

  try {
    const asset = await createAssetFromUpload({
      userId: session.user.id,
      file,
      type,
      name,
    });

    return NextResponse.json(
      {
        asset: {
          id: asset.id,
          type: asset.type,
          name: asset.name,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          createdAt: asset.createdAt,
        },
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload asset." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}

