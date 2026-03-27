"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { OnboardingShell } from "../onboarding-shell";

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    price: 0,
    desc: "Start with the basics. No card needed.",
    features: ["10 secure links/month", "Banking, SSN & ID collection", "Email notifications"],
    cta: "Continue with Free",
    highlight: false,
  },
  {
    key: "BEGINNER",
    name: "Beginner",
    price: 15,
    desc: "For agents just getting started.",
    features: ["50 secure links/month", "Banking, SSN & ID collection", "Basic analytics", "Email support"],
    cta: "Start Beginner — $15/mo",
    highlight: false,
  },
  {
    key: "PRO",
    name: "Pro",
    price: 29,
    desc: "Unlimited links + all features.",
    features: ["Unlimited secure links", "File transfers", "Custom forms", "Priority support", "Advanced analytics"],
    cta: "Start Pro — $29/mo",
    highlight: true,
  },
  {
    key: "AGENCY",
    name: "Agency",
    price: 70,
    desc: "For teams and brokerages.",
    features: ["Everything in Pro", "Up to 5 team members", "Branded links", "Highest priority support"],
    cta: "Start Agency — $70/mo",
    highlight: false,
  },
];

export default function OnboardingPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextUrl = "/onboarding/first-request";

  async function handleSelect(planKey: string) {
    setError(null);
    setLoading(planKey);

    if (planKey === "FREE") {
      router.push(nextUrl);
      return;
    }

    try {
      const appUrl = window.location.origin;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          successUrl: `${appUrl}${nextUrl}`,
          cancelUrl: `${appUrl}/onboarding/plan`,
        }),
      });
      const data = await res.json();
      if (typeof data?.url === "string" && data.url.length > 0) {
        window.location.href = data.url;
        return;
      }
      if (res.status === 401) {
        window.location.href = `/auth?mode=signin&redirect=/onboarding/plan`;

        return;
      }
      setError(data?.error?.message ?? "Unable to start checkout. Please try again.");
      setLoading(null);
    } catch {
      setError("Unable to start checkout right now.");
      setLoading(null);
    }
  }

  return (
    <OnboardingShell currentStep={4}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Choose your plan</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Start free or unlock more with a paid plan. You can upgrade anytime from your dashboard.
          </p>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl border-2 p-5 flex flex-col gap-4 ${
                plan.highlight
                  ? "border-primary bg-primary/3 shadow-md shadow-primary/10"
                  : "border-border bg-white/80"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-end gap-1 mb-0.5">
                  <span className="text-xl font-black text-foreground">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-muted-foreground text-xs mb-1">/mo</span>}
                </div>
                <p className="text-xs font-semibold text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
              </div>

              <ul className="space-y-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.key)}
                disabled={loading !== null}
                className={`w-full h-10 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  plan.highlight
                    ? "bg-primary text-white hover:bg-primary/90"
                    : plan.key === "FREE"
                    ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                    : "bg-[#0F172A] text-white hover:bg-[#1E293B]"
                }`}
              >
                {loading === plan.key ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {plan.cta}
                    {plan.key !== "FREE" && <ArrowRight className="w-3.5 h-3.5" />}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Payments secured by Stripe · Cancel anytime · No hidden fees
        </p>
      </div>
    </OnboardingShell>
  );
}
