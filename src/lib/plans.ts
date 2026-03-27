export type Plan = "FREE" | "BEGINNER" | "PRO" | "AGENCY";

interface PlanConfig {
  name: string;
  monthlyLinkLimit: number | null; // null = unlimited
  canUseTransfers: boolean;
  canUseForms: boolean;
  maxTeamMembers: number;
}

export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    name: "Free",
    monthlyLinkLimit: 10,
    canUseTransfers: false,
    canUseForms: false,
    maxTeamMembers: 1,
  },
  BEGINNER: {
    name: "Beginner",
    monthlyLinkLimit: 50,
    canUseTransfers: false,
    canUseForms: false,
    maxTeamMembers: 1,
  },
  PRO: {
    name: "Pro",
    monthlyLinkLimit: null,
    canUseTransfers: true,
    canUseForms: true,
    maxTeamMembers: 1,
  },
  AGENCY: {
    name: "Agency",
    monthlyLinkLimit: null,
    canUseTransfers: true,
    canUseForms: true,
    maxTeamMembers: 5,
  },
};

export function getPlan(plan: string): PlanConfig {
  return PLANS[(plan as Plan) ?? "FREE"] ?? PLANS.FREE;
}

// Count links created by a user in the current calendar month
export async function getMonthlyLinkCount(
  db: import("@prisma/client").PrismaClient,
  agentId: string
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db.secureLink.count({ where: { agentId, createdAt: { gte: start } } });
}
