import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured, PRICE_IDS } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendPlanUpgradeEmail } from "@/lib/email";

type PriceKey = keyof typeof PRICE_IDS;

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return apiError(503, "STRIPE_NOT_CONFIGURED", "Billing is not configured.");
    }

    const session = await getServerSession(authOptions);
    if (!session) return apiError(401, "UNAUTHORIZED", "Please sign in to continue.");

    const body = await req.json() as { plan: string };
    const { plan } = body;
    const newPriceId = PRICE_IDS[plan as PriceKey];
    if (!newPriceId) return apiError(400, "INVALID_PLAN", "Invalid plan selected.");

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        displayName: true,
        stripeSubscriptionId: true,
        plan: true,
      },
    });
    if (!user) return apiError(404, "NOT_FOUND", "User not found.");

    if (!user.stripeSubscriptionId) {
      return apiError(400, "NO_SUBSCRIPTION", "No active subscription. Please use the checkout flow.");
    }

    // Retrieve current subscription to get the item ID
    const subscription = await getStripe().subscriptions.retrieve(user.stripeSubscriptionId);
    const existingItem = subscription.items.data[0];
    if (!existingItem) {
      return apiError(400, "NO_SUBSCRIPTION_ITEM", "Subscription has no items to update.");
    }

    // Update the subscription and invoice the prorated difference immediately.
    // "always_invoice" tells Stripe to generate + charge the invoice right now
    // against the customer's saved payment method — no new checkout needed.
    await getStripe().subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: existingItem.id, price: newPriceId }],
      proration_behavior: "always_invoice",
    });

    await db.user.update({
      where: { id: session.user.id },
      data: { plan },
    });

    if (plan !== "FREE") {
      sendPlanUpgradeEmail({
        toEmail: user.email,
        toName: user.displayName.split(" ")[0],
        plan,
      }).catch(() => {});
    }

    return apiSuccess({ plan });
  } catch (err) {
    console.error("[stripe/upgrade] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return apiError(500, "UPGRADE_FAILED", message);
  }
}
