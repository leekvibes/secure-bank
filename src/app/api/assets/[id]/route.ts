import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { deleteAssetFileIfAny } from "@/lib/asset-library";
import { NO_STORE_HEADERS } from "@/lib/http";

export async function DELETE(
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

  const force = req.nextUrl.searchParams.get("force") === "true";

  const asset = await db.agentAsset.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: {
      id: true,
      fileKey: true,
      secureLinkRefs: { select: { id: true } },
      formLinkRefs: { select: { id: true } },
    },
  });

  if (!asset) {
    return NextResponse.json(
      { error: "Asset not found." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const attachCount = asset.secureLinkRefs.length + asset.formLinkRefs.length;
  if (attachCount > 0 && !force) {
    return NextResponse.json(
      { error: "Asset is attached to existing links. Pass force=true to delete." },
      { status: 409, headers: NO_STORE_HEADERS }
    );
  }

  await db.agentAsset.delete({ where: { id: asset.id } });
  await deleteAssetFileIfAny(asset);

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}

