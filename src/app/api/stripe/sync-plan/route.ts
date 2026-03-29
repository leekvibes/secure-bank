import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured, planFromPriceId } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendPlanUpgradeEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";

const PLAN_RANK: Record<string, number> = {
  FREE: 0,
  BEGINNER: 1,
  PRO: 2,
  AGENCY: 3,
};

function classifyPlanTransition(oldPlan: string, newPlan: string): "upgrade" | "downgrade" | "same" {
  const oldRank = PLAN_RANK[oldPlan] ?? 0;
  const newRank = PLAN_RANK[newPlan] ?? 0;
  if (newRank > oldRank) return "upgrade";
  if (newRank < oldRank) return "downgrade";
  return "same";
}

async function writeBillingAuditOnce(args: {
  event: "BILLING_FIRST_PURCHASE" | "BILLING_PLAN_UPGRADED" | "BILLING_PLAN_DOWNGRADED";
  userId: string;
  req: NextRequest;
  sessionId: string;
  oldPlan: string;
  newPlan: string;
  subId: string | undefined;
  customerId: string | null;
}) {
  const recent = await db.auditLog.findFirst({
    where: {
      agentId: args.userId,
      event: args.event,
      metadata: { contains: args.sessionId },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return;

  await writeAuditLog({
    event: args.event,
    agentId: args.userId,
    request: args.req,
    metadata: {
      oldPlan: args.oldPlan,
      newPlan: args.newPlan,
      source: "sync-plan",
      stripeCheckoutSessionId: args.sessionId,
      stripeSubscriptionId: args.subId,
      stripeCustomerId: args.customerId,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return apiError(503, "STRIPE_NOT_CONFIGURED", "Billing is not configured.");
    }

    const body = await req.json() as { sessionId: string };
    const { sessionId } = body;
    if (!sessionId) return apiError(400, "MISSING_SESSION_ID", "Session ID required.");

    const checkoutSession = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    console.log("[stripe/sync-plan] session retrieved", {
      sessionId,
      status: checkoutSession.status,
      paymentStatus: checkoutSession.payment_status,
      metaUserId: checkoutSession.metadata?.userId,
      metaPlan: checkoutSession.metadata?.plan,
      customerId: checkoutSession.customer,
    });

    if (checkoutSession.status !== "complete") {
      return apiError(
        409,
        "CHECKOUT_PENDING",
        "Checkout is still finalizing. Please wait a moment and retry.",
        {
          checkoutStatus: checkoutSession.status,
          paymentStatus: checkoutSession.payment_status ?? null,
        }
      );
    }

    // Prefer userId from Stripe metadata — more reliable than session cookie
    // after a redirect (cookie can be stale, metadata is always accurate)
    const metaUserId = checkoutSession.metadata?.userId;
    let userId: string | null = metaUserId ?? null;

    if (!userId) {
      // Fall back to session cookie
      const session = await getServerSession(authOptions);
      userId = session?.user?.id ?? null;
    }

    console.log("[stripe/sync-plan] resolved userId", { userId });

    if (!userId) {
      return apiError(401, "UNAUTHORIZED", "Could not identify user. Please sign in and try again.");
    }

    const sub = checkoutSession.subscription;
    const subId = typeof sub === "string" ? sub : sub?.id;
    const priceId = typeof sub === "string"
      ? null
      : (sub as { items?: { data?: Array<{ price?: { id?: string } }> } })?.items?.data?.[0]?.price?.id;

    const plan = checkoutSession.metadata?.plan
      ?? (priceId ? planFromPriceId(priceId) : "FREE");

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true, plan: true, stripeSubscriptionId: true },
    });

    if (!user) return apiError(404, "NOT_FOUND", "User not found.");

    await db.user.update({
      where: { id: userId },
      data: {
        plan,
        ...(subId ? { stripeSubscriptionId: subId } : {}),
        ...(checkoutSession.customer ? { stripeCustomerId: checkoutSession.customer as string } : {}),
      },
    });

    if (!user.stripeSubscriptionId && user.plan === "FREE" && plan !== "FREE") {
      await writeBillingAuditOnce({
        event: "BILLING_FIRST_PURCHASE",
        userId,
        req,
        sessionId,
        oldPlan: user.plan,
        newPlan: plan,
        subId: subId ?? undefined,
        customerId: checkoutSession.customer as string | null,
      });
    } else {
      const transition = classifyPlanTransition(user.plan, plan);
      if (transition === "upgrade") {
        await writeBillingAuditOnce({
          event: "BILLING_PLAN_UPGRADED",
          userId,
          req,
          sessionId,
          oldPlan: user.plan,
          newPlan: plan,
          subId: subId ?? undefined,
          customerId: checkoutSession.customer as string | null,
        });
      } else if (transition === "downgrade") {
        await writeBillingAuditOnce({
          event: "BILLING_PLAN_DOWNGRADED",
          userId,
          req,
          sessionId,
          oldPlan: user.plan,
          newPlan: plan,
          subId: subId ?? undefined,
          customerId: checkoutSession.customer as string | null,
        });
      }
    }

    if (plan !== "FREE") {
      sendPlanUpgradeEmail({
        toEmail: user.email,
        toName: user.displayName.split(" ")[0],
        plan,
      }).catch(() => {});
    }

    return apiSuccess({ plan });
  } catch (err) {
    console.error("[stripe/sync-plan] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return apiError(500, "SYNC_FAILED", message);
  }
}
