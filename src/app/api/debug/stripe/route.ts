import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isStripeConfigured, getStripe } from "@/lib/stripe";

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (expected && provided !== expected) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const envPresence = {
    STRIPE_SECRET_KEY: isSet(process.env.STRIPE_SECRET_KEY),
    STRIPE_SECRET: isSet(process.env.STRIPE_SECRET),
    STRIPE_API_KEY: isSet(process.env.STRIPE_API_KEY),
    StripeSecretKey: isSet(process.env.StripeSecretKey),
    STRIPE_WEBHOOK_SECRET: isSet(process.env.STRIPE_WEBHOOK_SECRET),
    STRIPE_WEBHOOK_SIGNING_SECRET: isSet(process.env.STRIPE_WEBHOOK_SIGNING_SECRET),
  };

  let stripeInitOk = false;
  let stripeInitError: string | null = null;
  try {
    getStripe();
    stripeInitOk = true;
  } catch (err) {
    stripeInitError = err instanceof Error ? err.message : "Unknown Stripe init error";
  }

  return apiSuccess({
    stripeConfigured: isStripeConfigured(),
    stripeInitOk,
    stripeInitError,
    envPresence,
  });
}

