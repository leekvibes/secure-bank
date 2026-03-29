import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isDocumentTemplatesEnabledServer } from "@/lib/feature-flags";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const q = searchParams.get("q");
    const documentsEnabled = isDocumentTemplatesEnabledServer();

    const andConditions: Record<string, unknown>[] = [{ isActive: true }];

    if (!documentsEnabled) {
      andConditions.push({ type: { not: "DOCUMENT" } });
    } else {
      andConditions.push({
        OR: [{ type: { not: "DOCUMENT" } }, { type: "DOCUMENT", docStatus: "PUBLISHED" }],
      });
    }

    if (category && category !== "All") andConditions.push({ category });
    if (type) andConditions.push({ type });
    if (q) {
      andConditions.push({
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { tags: { contains: q } },
        ],
      });
    }

    const templates = await db.systemTemplate.findMany({
      where: { AND: andConditions },
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
        docVersion: true,
        docStatus: true,
        thumbnailUrl: true,
      },
      orderBy: [{ isFeatured: "desc" }, { usageCount: "desc" }, { title: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[templates/list]", err);
    return NextResponse.json({ error: "Failed to load templates." }, { status: 500 });
  }
}
