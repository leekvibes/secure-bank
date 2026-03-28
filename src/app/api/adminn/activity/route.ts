import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [recentLinks, recentSubmissions, recentSignups, recentForms] = await Promise.all([
    db.secureLink.findMany({
      orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, linkType: true, status: true, createdAt: true, clientName: true, agentId: true,
        agent: { select: { displayName: true, email: true } } },
    }),
    db.submission.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, createdAt: true,
        link: { select: { linkType: true, clientName: true, agent: { select: { displayName: true } } } } },
    }),
    db.user.findMany({
      where: { role: "AGENT" }, orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, email: true, displayName: true, plan: true, createdAt: true, emailVerified: true },
    }),
    db.form.findMany({
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, title: true, createdAt: true, status: true, agentId: true,
        agent: { select: { displayName: true } } },
    }),
  ]);

  return NextResponse.json({ recentLinks, recentSubmissions, recentSignups, recentForms });
}
