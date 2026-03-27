import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getStripe, isStripeConfigured, PRICE_IDS } from "@/lib/stripe";

// Simple diagnostic — only accessible to signed-in users
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: Record<string, unknown> = {
    configured: isStripeConfigured(),
    envKey: process.env.STRIPE_SECRET_KEY ? "present" : process.env.StripeSecretKey ? "present (legacy name)" : "MISSING",
    priceIds: PRICE_IDS,
  };

  if (!isStripeConfigured()) {
    return NextResponse.json(results);
  }

  // Try fetching each price to confirm they exist in Stripe
  const stripe = getStripe();
  for (const [name, priceId] of Object.entries(PRICE_IDS)) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      results[`price_${name}`] = { ok: true, active: price.active, currency: price.currency, amount: price.unit_amount };
    } catch (err) {
      results[`price_${name}`] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json(results);
}
