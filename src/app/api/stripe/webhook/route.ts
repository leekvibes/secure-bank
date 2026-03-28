import { NextRequest } from "next/server";
import { getStripe, planFromPriceId, isStripeConfigured } from "@/lib/stripe";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    console.error("[stripe/webhook] STRIPE_SECRET_KEY not set");
    return new Response("Stripe not configured", { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret =
    process.env.STRIPE_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SIGNING_SECRET ??
    null;

  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (!userId || !plan) break;
        const existing = await db.user.findUnique({ where: { id: userId }, select: { planOverride: true } });
        await db.user.update({
          where: { id: userId },
          data: {
            ...(existing?.planOverride == null ? { plan } : {}),
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = priceId ? planFromPriceId(priceId) : "FREE";
        const active = sub.status === "active" || sub.status === "trialing";
        const existing = await db.user.findUnique({ where: { id: userId }, select: { planOverride: true } });
        await db.user.update({
          where: { id: userId },
          data: {
            ...(existing?.planOverride == null ? { plan: active ? plan : "FREE" } : {}),
            stripeSubscriptionId: sub.id,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const existing = await db.user.findUnique({ where: { id: userId }, select: { planOverride: true } });
        await db.user.update({
          where: { id: userId },
          data: {
            ...(existing?.planOverride == null ? { plan: "FREE" } : {}),
            stripeSubscriptionId: null,
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        const customerId = invoice.customer as string;
        // Downgrade to FREE on payment failure (only if no manual override)
        await db.user.updateMany({
          where: { stripeCustomerId: customerId, planOverride: null },
          data: { plan: "FREE" },
        });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
