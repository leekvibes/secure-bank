"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Check, Shield, Lock, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const PLAN_DETAILS: Record<string, {
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
}> = {
  BEGINNER: {
    name: "Beginner",
    price: 15,
    features: ["50 secure links/month", "Banking & SSN collection", "Document upload", "Email notifications", "Basic analytics"],
  },
  PRO: {
    name: "Pro",
    price: 29,
    popular: true,
    features: ["Unlimited secure links", "File transfers", "Custom forms", "Advanced analytics", "Priority support"],
  },
  AGENCY: {
    name: "Agency",
    price: 70,
    features: ["Everything in Pro", "Up to 5 team members", "Branded links", "Team dashboard", "Highest priority support"],
  },
};

let stripePromise: Promise<Stripe | null> | null = null;
async function getStripePromise(): Promise<Promise<Stripe | null>> {
  if (!stripePromise) {
    const res = await fetch("/api/stripe/config");
    const data = await res.json();
    if (typeof data?.publishableKey === "string" && data.publishableKey.length > 0) {
      stripePromise = loadStripe(data.publishableKey);
    } else {
      stripePromise = Promise.resolve(null);
    }
  }
  return stripePromise;
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "PRO";
  const next = searchParams.get("next") ?? "/dashboard";

  const [stripeReady, setStripeReady] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStripePromise().then(setStripeReady).catch(() => setError("Failed to load payment provider."));
  }, []);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/embedded-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        successUrl: `${window.location.origin}/checkout/return?next=${encodeURIComponent(next)}`,
      }),
    });
    const data = await res.json();
    if (res.status === 401) {
      window.location.href = `/auth?mode=signin&redirect=${encodeURIComponent(`/checkout?plan=${plan}&next=${next}`)}`;
      throw new Error("Please sign in to continue.");
    }
    if (typeof data?.clientSecret !== "string" || data.clientSecret.length === 0) {
      throw new Error(data.error?.message ?? "Failed to create checkout session.");
    }
    return data.clientSecret as string;
  }, [plan, next]);

  const planDetails = PLAN_DETAILS[plan];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/pricing" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to pricing
        </Link>
        <BrandLogo size="sm" />
        <div className="w-24" />
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left — Order Summary */}
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#00A3FF] uppercase tracking-widest mb-1">Your plan</p>
              <h1 className="text-2xl font-bold text-gray-900">
                {planDetails ? `${planDetails.name} Plan` : "Checkout"}
              </h1>
            </div>

            {planDetails && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Monthly subscription</p>
                    <p className="text-3xl font-black text-gray-900 mt-0.5">
                      ${planDetails.price}<span className="text-base font-medium text-gray-400">/mo</span>
                    </p>
                  </div>
                  {planDetails.popular && (
                    <span className="text-[11px] font-bold bg-[#00A3FF] text-white px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">What&apos;s included</p>
                  <ul className="space-y-2">
                    {planDetails.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-[#00A3FF]/10 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-[#00A3FF]" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Total today</p>
                  <p className="text-base font-bold text-gray-900">${planDetails.price}.00 / month</p>
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-500">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-gray-500" />
                </div>
                Payments are secured and processed by Stripe
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-500">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-gray-500" />
                </div>
                256-bit SSL encryption on all transactions
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-500">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-gray-500" />
                </div>
                Cancel anytime — no contracts, no hidden fees
              </div>
            </div>
          </div>

          {/* Right — Stripe Embedded Checkout */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {error ? (
              <div className="p-8 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <Link href="/pricing" className="mt-4 inline-block text-sm text-[#00A3FF] hover:underline">
                  ← Back to pricing
                </Link>
              </div>
            ) : stripeReady ? (
              <EmbeddedCheckoutProvider
                stripe={stripeReady}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            ) : (
              <div className="p-8 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#00A3FF] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00A3FF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutInner />
    </Suspense>
  );
}
