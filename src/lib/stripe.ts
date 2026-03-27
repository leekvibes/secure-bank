import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripeSecretKey(): string | null {
  // Support legacy/misnamed variants to avoid staging outages.
  return (
    process.env.STRIPE_SECRET_KEY ??
    process.env.STRIPE_SECRET ??
    process.env.STRIPE_API_KEY ??
    process.env.StripeSecretKey ??
    null
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

export function getStripe(): Stripe {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

export const PRICE_IDS = {
  BEGINNER: "price_1TFey5PuWrI0rDqlFyMcyfDK",
  PRO:      "price_1TFeyQPuWrI0rDqlBK03KVlA",
  AGENCY:   "price_1TFezNPuWrI0rDqlCyN36sgt",
} as const;

export function planFromPriceId(priceId: string): string {
  const entry = Object.entries(PRICE_IDS).find(([, id]) => id === priceId);
  return entry ? entry[0] : "FREE";
}
