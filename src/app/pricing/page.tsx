"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    price: 0,
    desc: "Get started with no commitment.",
    color: "border-gray-200",
    badge: null,
    features: [
      "10 secure links/month",
      "Banking info collection",
      "SSN & identity collection",
      "Document upload",
      "MySecureLink branding",
      "Email notifications",
    ],
    locked: [
      "File transfers",
      "Custom forms",
      "Priority support",
      "Advanced analytics",
    ],
    cta: "Get started free",
    ctaStyle: "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50",
  },
  {
    key: "BEGINNER",
    name: "Beginner",
    price: 15,
    desc: "For agents just getting started.",
    color: "border-gray-200",
    badge: null,
    features: [
      "50 secure links/month",
      "Banking info collection",
      "SSN & identity collection",
      "Document upload",
      "Email notifications",
      "Basic analytics",
      "Email support",
    ],
    locked: [
      "File transfers",
      "Custom forms",
      "Priority support",
    ],
    cta: "Start Beginner",
    ctaStyle: "bg-[#0F172A] text-white hover:bg-[#1E293B]",
  },
  {
    key: "PRO",
    name: "Pro",
    price: 29,
    desc: "For active agents who need everything.",
    color: "border-[#00A3FF]",
    badge: "Most Popular",
    features: [
      "Unlimited secure links",
      "Banking info collection",
      "SSN & identity collection",
      "Document upload",
      "File transfers",
      "Custom forms",
      "Advanced analytics",
      "Priority support",
    ],
    locked: [],
    cta: "Start Pro",
    ctaStyle: "bg-[#00A3FF] text-white hover:bg-[#0091E6]",
  },
  {
    key: "AGENCY",
    name: "Agency",
    price: 70,
    desc: "For teams and brokerages.",
    color: "border-gray-200",
    badge: null,
    features: [
      "Unlimited secure links",
      "Banking info collection",
      "SSN & identity collection",
      "Document upload",
      "File transfers",
      "Custom forms",
      "Up to 5 team members",
      "Team dashboard",
      "Branded links",
      "Highest priority support",
    ],
    locked: [],
    cta: "Start Agency",
    ctaStyle: "bg-[#0F172A] text-white hover:bg-[#1E293B]",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(planKey: string) {
    if (planKey === "FREE") {
      router.push("/auth?mode=signup");
      return;
    }
    setError(null);
    setLoading(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (typeof data?.url === "string" && data.url.length > 0) {
        window.location.href = data.url;
        return;
      }

      if (res.status === 401) {
        router.push(`/auth?mode=signup&redirect=/pricing`);
      } else {
        setError(data?.error?.message ?? "Unable to start checkout right now.");
      }
    } catch {
      setError("Unable to start checkout right now.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 border-b border-gray-100 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/"><BrandLogo size="sm" /></Link>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/auth?mode=signup"
              className="text-sm font-semibold bg-[#0F172A] hover:bg-[#1E293B] text-white px-5 py-2 rounded-lg transition-colors">
              Start Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-20 pb-12 px-5 text-center">
        <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">Pricing</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] tracking-tight mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          No hidden fees. No contracts. Cancel anytime.
        </p>
      </section>

      {/* Plan cards */}
      <section className="pb-24 px-5">
        {error ? (
          <div className="max-w-6xl mx-auto mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div key={plan.key}
              className={`relative rounded-2xl border-2 ${plan.color} p-7 flex flex-col ${plan.key === "PRO" ? "shadow-xl shadow-[#00A3FF]/10" : ""}`}>
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#00A3FF] text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-black text-[#0F172A]">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-gray-400 text-sm mb-1.5">/mo</span>}
                </div>
                <p className="text-sm text-gray-500">{plan.desc}</p>
              </div>

              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={loading === plan.key}
                className={`w-full h-11 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 mb-7 disabled:opacity-60 ${plan.ctaStyle}`}
              >
                {loading === plan.key ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.cta}
              </button>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-[#00A3FF] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
                {plan.locked.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300 line-through">
                    <Check className="w-4 h-4 text-gray-200 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust line */}
        <p className="text-center text-sm text-gray-400 mt-10">
          Payments secured by Stripe · Cancel anytime from your dashboard · No credit card required for Free
        </p>
      </section>
    </main>
  );
}
