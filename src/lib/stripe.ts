import Stripe from "stripe";

export const stripe = new Stripe(process.env.StripeSecretKey!, {
  apiVersion: "2025-01-27.acacia",
});

export const PRICE_IDS = {
  BEGINNER: "price_1TFey5PuWrI0rDqlFyMcyfDK",
  PRO:      "price_1TFeyQPuWrI0rDqlBK03KVlA",
  AGENCY:   "price_1TFezNPuWrI0rDqlCyN36sgt",
} as const;

// Map a Stripe price ID back to our plan name
export function planFromPriceId(priceId: string): string {
  const entry = Object.entries(PRICE_IDS).find(([, id]) => id === priceId);
  return entry ? entry[0] : "FREE";
}
