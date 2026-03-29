import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isDocumentTemplatesEnabledServer } from "@/lib/feature-flags";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const documentsEnabled = isDocumentTemplatesEnabledServer();
    const template = await db.systemTemplate.findUnique({
      where: { id: params.id, isActive: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    if (!documentsEnabled && template.type === "DOCUMENT") {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    if (template.type === "DOCUMENT" && template.docStatus !== "PUBLISHED") {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (err) {
    console.error("[templates/get]", err);
    return NextResponse.json({ error: "Failed to load template." }, { status: 500 });
  }
}
