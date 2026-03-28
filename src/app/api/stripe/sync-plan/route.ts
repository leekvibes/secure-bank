import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured, planFromPriceId } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendPlanUpgradeEmail } from "@/lib/email";

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

    if (checkoutSession.status !== "complete") {
      return apiError(400, "CHECKOUT_INCOMPLETE", "Payment not completed.");
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
      select: { email: true, displayName: true },
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
