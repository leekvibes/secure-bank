import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured, planFromPriceId } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return apiError(503, "STRIPE_NOT_CONFIGURED", "Billing is not configured.");
    }

    const session = await getServerSession(authOptions);
    if (!session) return apiError(401, "UNAUTHORIZED", "Please sign in to continue.");

    const body = await req.json() as { sessionId: string };
    const { sessionId } = body;
    if (!sessionId) return apiError(400, "MISSING_SESSION_ID", "Session ID required.");

    const checkoutSession = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkoutSession.status !== "complete") {
      return apiError(400, "CHECKOUT_INCOMPLETE", "Payment not completed.");
    }

    const sub = checkoutSession.subscription;
    const subId = typeof sub === "string" ? sub : sub?.id;
    const priceId = typeof sub === "string"
      ? null
      : (sub as { items?: { data?: Array<{ price?: { id?: string } }> } })?.items?.data?.[0]?.price?.id;

    const plan = checkoutSession.metadata?.plan
      ?? (priceId ? planFromPriceId(priceId) : "FREE");

    await db.user.update({
      where: { id: session.user.id },
      data: {
        plan,
        ...(subId ? { stripeSubscriptionId: subId } : {}),
      },
    });

    return apiSuccess({ plan });
  } catch (err) {
    console.error("[stripe/sync-plan] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return apiError(500, "SYNC_FAILED", message);
  }
}
