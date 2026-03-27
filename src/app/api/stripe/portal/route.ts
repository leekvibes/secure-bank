import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return apiError(
      503,
      "STRIPE_NOT_CONFIGURED",
      "Billing portal is temporarily unavailable."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) return apiError(401, "UNAUTHORIZED", "Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return apiError(400, "NO_SUBSCRIPTION", "No active subscription found.");
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard/settings`,
  });

  return apiSuccess({ url: portalSession.url });
}
