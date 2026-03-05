import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import {
  ensureLegacyLogoAsset,
  toAssetRenderEntry,
  createAssetFromUpload,
  deleteAssetFileIfAny,
  ASSET_TYPES,
} from "@/lib/asset-library";

// GET — list all agent assets (migrations legacy logoUrl lazily)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureLegacyLogoAsset(session.user.id);

  const raw = await db.agentAsset.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const assets = await Promise.all(raw.map(toAssetRenderEntry));

  return NextResponse.json({ assets: assets.filter((a) => a.url) });
}

// POST — upload a new asset (multipart/form-data: file, type?, name?)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const type = (formData.get("type") as string | null) ?? "LOGO";
    const name = (formData.get("name") as string | null) ?? undefined;

    const asset = await createAssetFromUpload({
      userId: session.user.id,
      file,
      type,
      name,
    });

    const rendered = await toAssetRenderEntry(asset);
    return NextResponse.json({ asset: rendered }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// DELETE — remove an asset by id (?id=xxx)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const asset = await db.agentAsset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!asset) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteAssetFileIfAny(asset);
  await db.agentAsset.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
