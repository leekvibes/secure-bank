import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPlan, getMonthlyLinkCount, getTotalLinkCount } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  const plan = user?.plan ?? "FREE";
  const planConfig = getPlan(plan);

  let used: number;
  if (planConfig.lifetimeLimit) {
    used = await getTotalLinkCount(db, session.user.id);
  } else {
    used = await getMonthlyLinkCount(db, session.user.id);
  }

  const limit = planConfig.linkLimit;
  const percentUsed = limit !== null ? Math.round((used / limit) * 100) : null;

  return apiSuccess({
    used,
    limit,
    lifetimeLimit: planConfig.lifetimeLimit,
    plan,
    percentUsed,
  });
}
