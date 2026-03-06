import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { NO_STORE_HEADERS } from "@/lib/http";

const MAX_PHOTO_BYTES = 512 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPG, or WebP files are accepted." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "Photo must be under 512 KB." },
      { status: 413, headers: NO_STORE_HEADERS }
    );
  }

  const base64 = Buffer.from(bytes).toString("base64");
  const photoUrl = `data:${file.type};base64,${base64}`;

  await db.user.update({
    where: { id: session.user.id },
    data: { photoUrl },
  });

  return NextResponse.json({ success: true, photoUrl }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { photoUrl: null },
  });

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
