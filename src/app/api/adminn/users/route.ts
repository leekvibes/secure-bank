import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const plan = searchParams.get("plan") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 25;

  const where: Record<string, unknown> = { role: "AGENT" };
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (plan) where.plan = plan;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true, email: true, displayName: true, plan: true, planOverride: true, planOverrideNote: true,
        emailVerified: true, bannedAt: true, banReason: true, createdAt: true,
        stripeSubscriptionId: true, stripeCustomerId: true,
        _count: { select: { links: true, forms: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
}
