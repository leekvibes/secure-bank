import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } });
  const planConfig = getPlan(user?.plan ?? "FREE");
  if (!planConfig.canUseTransfers) {
    return NextResponse.json(
      { error: "File transfers are available on Pro and Agency plans. Upgrade to unlock.", code: "UPGRADE_REQUIRED" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024, // 2GB per file
          addRandomSuffix: true, // prevent "blob already exists" on re-upload
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
