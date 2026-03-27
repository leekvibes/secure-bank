"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, X, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
    locked: ["File transfers", "Custom forms", "Priority support", "Advanced analytics"],
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
    locked: ["File transfers", "Custom forms", "Priority support"],
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

type Step = "email" | "signup" | "signin";

export default function PricingPage() {
  const router = useRouter();

  // Modal state
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal(planKey: string) {
    if (planKey === "FREE") {
      router.push("/auth?mode=signup");
      return;
    }
    setSelectedPlan(planKey);
    setStep("email");
    setEmail("");
    setName("");
    setPassword("");
    setError(null);
    setShowPassword(false);
  }

  function closeModal() {
    setSelectedPlan(null);
    setStep("email");
    setEmail("");
    setName("");
    setPassword("");
    setError(null);
    setLoading(false);
  }

  async function handleEmailStep(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      setStep(data.exists ? "signin" : "signup");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      // Register
      const regRes = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          confirmPassword: password,
          displayName: name.trim(),
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        setError(regData.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // Auto sign in
      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!loginRes.ok) {
        setError("Account created! Please sign in to continue.");
        setLoading(false);
        return;
      }

      // Go to checkout — after payment, redirect to email verification, then onboarding
      const afterVerify = encodeURIComponent("/onboarding/first-request");
      const next = encodeURIComponent(`/verify-email?redirect=${afterVerify}`);
      window.location.href = `/checkout?plan=${selectedPlan}&next=${next}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect password. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = `/checkout?plan=${selectedPlan}&next=${encodeURIComponent("/dashboard/settings")}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const planInfo = PLANS.find((p) => p.key === selectedPlan);

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
                onClick={() => openModal(plan.key)}
                className={`w-full h-11 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 mb-7 ${plan.ctaStyle}`}
              >
                {plan.cta}
              </button>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-[#00A3FF] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
                {plan.locked.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300 line-through">
                    <Check className="w-4 h-4 text-gray-200 shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-10">
          Payments secured by Stripe · Cancel anytime from your dashboard · No credit card required for Free
        </p>
      </section>

      {/* Inline auth modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>

            {/* Plan badge */}
            {planInfo && (
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 bg-[#00A3FF]/8 text-[#0077CC] text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                  {planInfo.name} Plan — ${planInfo.price}/mo
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {step === "email" && "Enter your email to get started"}
                  {step === "signup" && "Create your account"}
                  {step === "signin" && "Welcome back"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {step === "email" && "We'll check if you have an account or create one for you."}
                  {step === "signup" && email}
                  {step === "signin" && email}
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Step 1: Email */}
            {step === "email" && (
              <form onSubmit={handleEmailStep} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 rounded-xl bg-[#00A3FF] text-white font-semibold text-sm hover:bg-[#0091E6] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Already have an account? Just enter your email.
                </p>
              </form>
            )}

            {/* Step 2a: Sign up */}
            {step === "signup" && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Taylor"
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || password.length < 8}
                  className="w-full h-11 rounded-xl bg-[#00A3FF] text-white font-semibold text-sm hover:bg-[#0091E6] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account & continue <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => { setStep("email"); setError(null); setPassword(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-3.5 h-3.5" /> Use a different email
                </button>
              </form>
            )}

            {/* Step 2b: Sign in */}
            {step === "signin" && (
              <form onSubmit={handleSignin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-right mt-1">
                    <Link href="/auth/reset" className="text-xs text-[#00A3FF] hover:underline">Forgot password?</Link>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full h-11 rounded-xl bg-[#00A3FF] text-white font-semibold text-sm hover:bg-[#0091E6] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in & continue <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => { setStep("email"); setError(null); setPassword(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-3.5 h-3.5" /> Use a different email
                </button>
              </form>
            )}

            <p className="text-xs text-gray-400 text-center mt-5">
              Payments secured by Stripe · Cancel anytime
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
