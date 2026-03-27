import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, PRICE_IDS, isStripeConfigured } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";

type PriceKey = keyof typeof PRICE_IDS;

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return apiError(
      503,
      "STRIPE_NOT_CONFIGURED",
      "Billing is temporarily unavailable. Please try again later."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  const body = await req.json() as { plan: string; successUrl?: string; cancelUrl?: string };
  const { plan } = body;
  const priceId = PRICE_IDS[plan as PriceKey];
  if (!priceId) return apiError(400, "INVALID_PLAN", "Invalid plan.");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true },
  });
  if (!user) return apiError(404, "NOT_FOUND", "User not found.");

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

  // Reuse existing Stripe customer or create one
  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await getStripe().customers.create({ email: user.email });
    customerId = customer.id;
    await db.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: body.successUrl ?? `${appUrl}/dashboard/settings?upgraded=1`,
    cancel_url: body.cancelUrl ?? `${appUrl}/pricing`,
    metadata: { userId: session.user.id, plan },
    subscription_data: { metadata: { userId: session.user.id, plan } },
  });

  return apiSuccess({ url: checkoutSession.url });
}
