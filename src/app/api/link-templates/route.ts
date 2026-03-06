import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { linkTemplateSchema } from "@/lib/schemas";
import { createLinkTemplate, listLinkTemplates } from "@/lib/link-templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await listLinkTemplates(session.user.id);
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = linkTemplateSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Invalid payload." }, { status: 400 });
  }

  try {
    const template = await createLinkTemplate(session.user.id, parsed.data);
    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template." },
      { status: 400 }
    );
  }
}
