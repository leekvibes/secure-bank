export type Plan = "FREE" | "BEGINNER" | "PRO" | "AGENCY";
export type PlanFeature = "SECURE_LINKS" | "FORMS" | "TRANSFERS";

export interface PlanConfig {
  name: string;
  linkLimit: number | null;        // null = unlimited
  lifetimeLimit: boolean;          // true = total ever (FREE), false = per calendar month
  features: readonly PlanFeature[];
  canUseTransfers: boolean;
  canUseForms: boolean;
  canUseSigning: boolean;
  canUseDocumentTemplates: boolean;
  docsignMonthlyLimit: number | null; // null = unlimited; FREE=3, BEGINNER=15
  maxTeamMembers: number;
}

export const PLAN_ORDER: readonly Plan[] = ["FREE", "BEGINNER", "PRO", "AGENCY"];

export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    name: "Free",
    linkLimit: 10,
    lifetimeLimit: true,
    features: ["SECURE_LINKS"],
    canUseTransfers: false,
    canUseForms: false,
    canUseSigning: true,
    canUseDocumentTemplates: true,
    docsignMonthlyLimit: 3,
    maxTeamMembers: 1,
  },
  BEGINNER: {
    name: "Beginner",
    linkLimit: 50,
    lifetimeLimit: false,
    features: ["SECURE_LINKS"],
    canUseTransfers: false,
    canUseForms: false,
    canUseSigning: true,
    canUseDocumentTemplates: true,
    docsignMonthlyLimit: 15,
    maxTeamMembers: 1,
  },
  PRO: {
    name: "Pro",
    linkLimit: null,
    lifetimeLimit: false,
    features: ["SECURE_LINKS", "FORMS", "TRANSFERS"],
    canUseTransfers: true,
    canUseForms: true,
    canUseSigning: true,
    canUseDocumentTemplates: true,
    docsignMonthlyLimit: null,
    maxTeamMembers: 1,
  },
  AGENCY: {
    name: "Agency",
    linkLimit: null,
    lifetimeLimit: false,
    features: ["SECURE_LINKS", "FORMS", "TRANSFERS"],
    canUseTransfers: true,
    canUseForms: true,
    canUseSigning: true,
    canUseDocumentTemplates: true,
    docsignMonthlyLimit: null,
    maxTeamMembers: 5,
  },
};

export function getPlan(plan: string): PlanConfig {
  return PLANS[(plan as Plan) ?? "FREE"] ?? PLANS.FREE;
}

export function hasPlanFeature(plan: string, feature: PlanFeature): boolean {
  return getPlan(plan).features.includes(feature);
}

export function validatePlanMatrix(): string[] {
  const issues: string[] = [];

  for (const plan of PLAN_ORDER) {
    const config = PLANS[plan];
    if (config.canUseForms !== config.features.includes("FORMS")) {
      issues.push(`${plan}: canUseForms does not match features.FORMS`);
    }
    if (config.canUseTransfers !== config.features.includes("TRANSFERS")) {
      issues.push(`${plan}: canUseTransfers does not match features.TRANSFERS`);
    }
    if (!config.canUseSigning && config.canUseDocumentTemplates) {
      issues.push(`${plan}: canUseDocumentTemplates requires canUseSigning`);
    }
    if (!config.features.includes("SECURE_LINKS")) {
      issues.push(`${plan}: SECURE_LINKS must be enabled`);
    }
  }

  for (let i = 1; i < PLAN_ORDER.length; i += 1) {
    const lower = PLAN_ORDER[i - 1];
    const higher = PLAN_ORDER[i];
    const lowerFeatures = Array.from(new Set(PLANS[lower].features));
    for (const feature of lowerFeatures) {
      if (!PLANS[higher].features.includes(feature)) {
        issues.push(`${higher}: missing inherited feature ${feature} from ${lower}`);
      }
    }
  }

  return issues;
}

export function canUseTransfers(plan: string): boolean {
  return hasPlanFeature(plan, "TRANSFERS");
}

export function canUseForms(plan: string): boolean {
  return hasPlanFeature(plan, "FORMS");
}

export function canUseDocumentTemplates(plan: string): boolean {
  return getPlan(plan).canUseDocumentTemplates;
}

// Count signing requests sent this calendar month (excludes DRAFT)
export async function getMonthlyDocSignCount(
  db: import("@prisma/client").PrismaClient,
  agentId: string
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db.docSignRequest.count({
    where: {
      agentId,
      status: { not: "DRAFT" },
      createdAt: { gte: start },
    },
  });
}

// Check if agent can send another signing request this month
export async function checkDocSignLimit(
  db: import("@prisma/client").PrismaClient,
  agentId: string,
  plan: string
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const config = getPlan(plan);
  const limit = config.docsignMonthlyLimit;
  if (limit === null) return { allowed: true, used: 0, limit: null };
  const used = await getMonthlyDocSignCount(db, agentId);
  return { allowed: used < limit, used, limit };
}

// Count links created this calendar month
export async function getMonthlyLinkCount(
  db: import("@prisma/client").PrismaClient,
  agentId: string
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  // Use immutable audit events so deletions don't reduce usage counts.
  return db.auditLog.count({
    where: {
      agentId,
      event: "LINK_CREATED",
      createdAt: { gte: start },
    },
  });
}

// Count all links ever created by this agent
export async function getTotalLinkCount(
  db: import("@prisma/client").PrismaClient,
  agentId: string
): Promise<number> {
  // Use immutable audit events so deletions don't reduce usage counts.
  return db.auditLog.count({
    where: {
      agentId,
      event: "LINK_CREATED",
    },
  });
}
