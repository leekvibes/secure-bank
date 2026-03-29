import { NextRequest } from "next/server";
import { getStripe, planFromPriceId, isStripeConfigured } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendSubscriptionCancelledEmail, sendPaymentFailedEmail, sendPlanUpgradeEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PLAN_RANK: Record<string, number> = {
  FREE: 0,
  BEGINNER: 1,
  PRO: 2,
  AGENCY: 3,
};

function classifyPlanTransition(oldPlan: string, newPlan: string): "upgrade" | "downgrade" | "same" {
  const oldRank = PLAN_RANK[oldPlan] ?? 0;
  const newRank = PLAN_RANK[newPlan] ?? 0;
  if (newRank > oldRank) return "upgrade";
  if (newRank < oldRank) return "downgrade";
  return "same";
}

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
        const existing = await db.user.findUnique({
          where: { id: userId },
          select: { planOverride: true, email: true, displayName: true, plan: true, stripeSubscriptionId: true },
        });
        if (!existing) break;
        await db.user.update({
          where: { id: userId },
          data: {
            ...(existing.planOverride == null ? { plan } : {}),
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });
        if (existing.planOverride == null) {
          if (!existing.stripeSubscriptionId && existing.plan === "FREE" && plan !== "FREE") {
            await writeAuditLog({
              event: "BILLING_FIRST_PURCHASE",
              agentId: userId,
              request: req,
              metadata: {
                oldPlan: existing.plan,
                newPlan: plan,
                stripeEventId: event.id,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
              },
            });
          } else {
            const transition = classifyPlanTransition(existing.plan, plan);
            if (transition === "upgrade") {
              await writeAuditLog({
                event: "BILLING_PLAN_UPGRADED",
                agentId: userId,
                request: req,
                metadata: {
                  oldPlan: existing.plan,
                  newPlan: plan,
                  stripeEventId: event.id,
                  stripeCustomerId: session.customer,
                  stripeSubscriptionId: session.subscription,
                },
              });
            } else if (transition === "downgrade") {
              await writeAuditLog({
                event: "BILLING_PLAN_DOWNGRADED",
                agentId: userId,
                request: req,
                metadata: {
                  oldPlan: existing.plan,
                  newPlan: plan,
                  stripeEventId: event.id,
                  stripeCustomerId: session.customer,
                  stripeSubscriptionId: session.subscription,
                },
              });
            }
          }
        }
        if (plan !== "FREE" && existing.planOverride == null) {
          sendPlanUpgradeEmail({
            toEmail: existing.email,
            toName: existing.displayName.split(" ")[0],
            plan,
          }).catch(() => {});
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = priceId ? planFromPriceId(priceId) : "FREE";
        const active = sub.status === "active" || sub.status === "trialing";
        const existing = await db.user.findUnique({ where: { id: userId }, select: { planOverride: true, plan: true } });
        if (!existing) break;
        const appliedPlan = active ? plan : "FREE";
        await db.user.update({
          where: { id: userId },
          data: {
            ...(existing.planOverride == null ? { plan: appliedPlan } : {}),
            stripeSubscriptionId: sub.id,
          },
        });
        if (existing.planOverride == null && existing.plan !== appliedPlan) {
          const transition = classifyPlanTransition(existing.plan, appliedPlan);
          if (transition === "upgrade") {
            await writeAuditLog({
              event: "BILLING_PLAN_UPGRADED",
              agentId: userId,
              request: req,
              metadata: {
                oldPlan: existing.plan,
                newPlan: appliedPlan,
                stripeEventId: event.id,
                stripeSubscriptionId: sub.id,
                stripeSubscriptionStatus: sub.status,
              },
            });
          } else if (transition === "downgrade") {
            await writeAuditLog({
              event: "BILLING_PLAN_DOWNGRADED",
              agentId: userId,
              request: req,
              metadata: {
                oldPlan: existing.plan,
                newPlan: appliedPlan,
                stripeEventId: event.id,
                stripeSubscriptionId: sub.id,
                stripeSubscriptionStatus: sub.status,
              },
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const existing = await db.user.findUnique({
          where: { id: userId },
          select: { planOverride: true, plan: true, email: true, displayName: true },
        });
        if (!existing) break;
        await db.user.update({
          where: { id: userId },
          data: {
            ...(existing?.planOverride == null ? { plan: "FREE" } : {}),
            stripeSubscriptionId: null,
          },
        });
        if (existing.planOverride == null) {
          await writeAuditLog({
            event: "BILLING_SUBSCRIPTION_CANCELLED",
            agentId: userId,
            request: req,
            metadata: {
              oldPlan: existing.plan,
              newPlan: "FREE",
              stripeEventId: event.id,
              stripeSubscriptionId: sub.id,
              stripeSubscriptionStatus: sub.status,
            },
          });
        }
        if (existing?.email && existing.planOverride == null) {
          sendSubscriptionCancelledEmail({
            toEmail: existing.email,
            toName: existing.displayName?.split(" ")[0] ?? "there",
            previousPlan: existing.plan,
          }).catch(() => {});
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        const customerId = invoice.customer as string;
        const affected = await db.user.findFirst({
          where: { stripeCustomerId: customerId, planOverride: null },
          select: { id: true, email: true, displayName: true, plan: true },
        });
        await db.user.updateMany({
          where: { stripeCustomerId: customerId, planOverride: null },
          data: { plan: "FREE" },
        });
        if (affected) {
          await writeAuditLog({
            event: "BILLING_PAYMENT_FAILED",
            agentId: affected.id,
            request: req,
            metadata: {
              oldPlan: affected.plan,
              newPlan: "FREE",
              stripeEventId: event.id,
              stripeCustomerId: customerId,
              stripeInvoiceId: invoice.id,
              stripeInvoiceStatus: invoice.status,
            },
          });
        }
        if (affected?.email) {
          sendPaymentFailedEmail({
            toEmail: affected.email,
            toName: affected.displayName?.split(" ")[0] ?? "there",
          }).catch(() => {});
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
