import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const q = searchParams.get("q");

    const templates = await db.systemTemplate.findMany({
      where: {
        isActive: true,
        ...(category && category !== "All" ? { category } : {}),
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
                { tags: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        industry: true,
        type: true,
        linkType: true,
        tags: true,
        isFeatured: true,
        usageCount: true,
        complianceGuarded: true,
        coreFieldLabels: true,
      },
      orderBy: [{ isFeatured: "desc" }, { usageCount: "desc" }, { title: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[templates/list]", err);
    return NextResponse.json({ error: "Failed to load templates." }, { status: 500 });
  }
}
