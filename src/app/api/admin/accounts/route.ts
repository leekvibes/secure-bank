import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { displayName: { contains: q, mode: "insensitive" as const } },
          { company: { contains: q, mode: "insensitive" as const } },
          { agencyName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        company: true,
        agencyName: true,
        industry: true,
        verificationStatus: true,
        role: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        _count: { select: { links: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
}
