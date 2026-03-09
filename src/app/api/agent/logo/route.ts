import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { NO_STORE_HEADERS } from "@/lib/http";

const MAX_LOGO_BYTES = 512 * 1024;
const MAX_LOGOS = 5;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const logos = await db.agentAsset.findMany({
    where: { userId: session.user.id, type: "LOGO" },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, createdAt: true },
  });

  return NextResponse.json({ logos }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const existingCount = await db.agentAsset.count({
    where: { userId: session.user.id, type: "LOGO" },
  });
  if (existingCount >= MAX_LOGOS) {
    return NextResponse.json(
      { error: `You can upload up to ${MAX_LOGOS} logos. Please remove one first.` },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const file = formData.get("logo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPG, WebP, or SVG files are accepted." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "Logo must be under 512 KB." },
      { status: 413, headers: NO_STORE_HEADERS }
    );
  }

  const base64 = Buffer.from(bytes).toString("base64");
  const logoUrl = `data:${file.type};base64,${base64}`;

  const asset = await db.agentAsset.create({
    data: {
      userId: session.user.id,
      type: "LOGO",
      url: logoUrl,
      mimeType: file.type,
      sizeBytes: bytes.byteLength,
    },
  });

  await db.user.update({
    where: { id: session.user.id },
    data: { logoUrl },
  });

  return NextResponse.json({ success: true, logoUrl, assetId: asset.id }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("id");

  if (assetId) {
    const asset = await db.agentAsset.findFirst({
      where: { id: assetId, userId: session.user.id, type: "LOGO" },
    });
    if (!asset) {
      return NextResponse.json({ error: "Logo not found." }, { status: 404, headers: NO_STORE_HEADERS });
    }
    await db.agentAsset.delete({ where: { id: assetId } });

    const remaining = await db.agentAsset.findFirst({
      where: { userId: session.user.id, type: "LOGO" },
      orderBy: { createdAt: "desc" },
    });
    await db.user.update({
      where: { id: session.user.id },
      data: { logoUrl: remaining?.url ?? null },
    });
  } else {
    await db.agentAsset.deleteMany({
      where: { userId: session.user.id, type: "LOGO" },
    });
    await db.user.update({
      where: { id: session.user.id },
      data: { logoUrl: null },
    });
  }

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
