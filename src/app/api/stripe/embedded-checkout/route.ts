import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, PRICE_IDS, isStripeConfigured } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";

type PriceKey = keyof typeof PRICE_IDS;

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return apiError(503, "STRIPE_NOT_CONFIGURED", "Billing is not configured.");
    }

    const session = await getServerSession(authOptions);
    if (!session) return apiError(401, "UNAUTHORIZED", "Please sign in to continue.");

    const body = await req.json() as { plan: string; successUrl?: string; cancelUrl?: string };
    const { plan } = body;
    const priceId = PRICE_IDS[plan as PriceKey];
    if (!priceId) return apiError(400, "INVALID_PLAN", "Invalid plan selected.");

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user) return apiError(404, "NOT_FOUND", "User not found.");

    const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await getStripe().customers.create({ email: user.email });
      customerId = customer.id;
      await db.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
    }

    const returnUrl = body.successUrl ?? `${appUrl}/checkout/return`;
    const returnUrlObj = new URL(returnUrl, appUrl);
    // Keep the Stripe placeholder unescaped so Stripe replaces it with a real session id.
    returnUrlObj.searchParams.set("session_id", "__CHECKOUT_SESSION_ID__");
    const stripeReturnUrl = returnUrlObj
      .toString()
      .replace("__CHECKOUT_SESSION_ID__", "{CHECKOUT_SESSION_ID}");

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      ui_mode: "embedded_page",
      redirect_on_completion: "always",
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: stripeReturnUrl,
      metadata: { userId: session.user.id, plan },
      subscription_data: { metadata: { userId: session.user.id, plan } },
    });

    if (!checkoutSession.client_secret) {
      return apiError(500, "NO_CLIENT_SECRET", "Stripe did not return a client secret.");
    }

    return apiSuccess({ clientSecret: checkoutSession.client_secret });
  } catch (err) {
    console.error("[stripe/embedded-checkout] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return apiError(500, "CHECKOUT_FAILED", message);
  }
}
