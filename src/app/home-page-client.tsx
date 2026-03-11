"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock, Clock, Eye, Shield, ArrowRight, Fingerprint,
  CheckCircle, FileText, CreditCard, Building2, Loader2,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

function EmailCTA({ size = "md" }: { size?: "sm" | "md" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      const encoded = encodeURIComponent(email.trim());
      if (data.exists) {
        router.push(`/auth?email=${encoded}`);
      } else {
        router.push(`/auth?mode=signup&email=${encoded}`);
      }
    } catch {
      router.push(`/auth?mode=signup&email=${encodeURIComponent(email.trim())}`);
    }
  }

  const inputCls = size === "sm"
    ? "h-10 text-sm px-4 rounded-lg"
    : "h-12 text-base px-5 rounded-xl";
  const btnCls = size === "sm"
    ? "h-10 px-5 text-sm rounded-lg"
    : "h-12 px-7 text-base rounded-xl";

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          required
          className={`flex-1 border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#00A3FF]/60 focus:border-transparent ${inputCls}`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`bg-[#00A3FF] hover:bg-[#0091E6] text-white font-semibold transition-colors flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 ${btnCls}`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Start Free
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
      <p className="mt-3 text-[11px] text-white/35 leading-relaxed">
        By clicking the Start Free button, you agree to SecureLink&apos;s{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition-colors">Terms &amp; Conditions</Link>
        {" "}and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
}

const FEATURES = [
  {
    icon: Lock,
    title: "AES-256 Encrypted",
    desc: "Every field encrypted individually before storage. Plaintext never touches our database.",
  },
  {
    icon: Clock,
    title: "Auto-Expiring Links",
    desc: "Links expire on your schedule — default 24 hours. No lingering access.",
  },
  {
    icon: Eye,
    title: "One-Time Access",
    desc: "Submissions are masked after first reveal. Data deleted after your retention window.",
  },
  {
    icon: Shield,
    title: "Full Audit Trail",
    desc: "Every action — created, opened, submitted, revealed — is logged for compliance.",
  },
  {
    icon: FileText,
    title: "ID & Document Upload",
    desc: "Collect driver's licenses, passports, and documents with guided client instructions.",
  },
  {
    icon: Fingerprint,
    title: "Routing Verification",
    desc: "Instantly verify bank routing numbers. Reduce errors before they become problems.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Build your request form",
    desc: "Choose what to collect — banking info, IDs, signatures, or custom fields. Takes 30 seconds.",
  },
  {
    n: "2",
    title: "Send a secure link",
    desc: "Copy the link or send it by text. Your client opens it on any device, no account needed.",
  },
  {
    n: "3",
    title: "Receive encrypted data",
    desc: "Data arrives in your dashboard, encrypted and ready to reveal when you need it.",
  },
];

const USE_CASES = [
  { icon: Building2, label: "Real Estate", sub: "Collect earnest money details & IDs" },
  { icon: CreditCard, label: "Mortgage", sub: "Bank info, SSNs & income docs" },
  { icon: FileText, label: "Insurance", sub: "Policy forms & signature collection" },
  { icon: Shield, label: "Financial Advisory", sub: "Secure onboarding & KYC docs" },
];

export function HomePageClient() {
  return (
    <main className="min-h-screen bg-white text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/auth?mode=signup"
              className="text-sm font-semibold bg-[#00A3FF] hover:bg-[#0091E6] text-white px-5 py-2 rounded-lg transition-colors"
            >
              JOIN FREE
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-[#0F172A] pt-24 pb-32 px-5 relative overflow-hidden">
        {/* Subtle grid bg */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#00A3FF 1px, transparent 1px), linear-gradient(90deg, #00A3FF 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#00A3FF]/12 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00A3FF]/10 border border-[#00A3FF]/20 mb-8">
            <Fingerprint className="w-3.5 h-3.5 text-[#00A3FF]" />
            <span className="text-xs font-medium text-[#00A3FF] tracking-wide uppercase">
              Trusted by real estate, finance &amp; legal professionals
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-6">
            Everything you need to{" "}
            <span className="text-[#00A3FF]">securely collect</span>{" "}
            client information
          </h1>

          <p className="text-lg sm:text-xl text-white/55 leading-relaxed max-w-xl mx-auto mb-10">
            Send encrypted requests for banking details, documents, and
            signatures in seconds.
          </p>

          <div className="flex justify-center mb-4">
            <EmailCTA />
          </div>
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────────────────── */}
      <section className="bg-[#0A1120] border-b border-white/8 py-5 px-5">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-xs text-white/35 uppercase tracking-widest font-medium">
            Secure collection for
          </span>
          {["Banking Info", "SSNs", "Driver's Licenses", "Signatures", "Tax Documents"].map((label) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-white/55">
              <CheckCircle className="w-3.5 h-3.5 text-[#00A3FF]/70 shrink-0" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-[#F8FAFC] py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
              From request to received in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connector line desktop */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-transparent via-[#00A3FF]/30 to-transparent" />

            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="relative flex flex-col items-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[#00A3FF] flex items-center justify-center mb-6 shrink-0 shadow-lg shadow-[#00A3FF]/25">
                  <span className="text-xl font-black text-white">{n}</span>
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">{title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-5 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">Built for professionals</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
              Your industry, your workflow
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {USE_CASES.map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="p-6 rounded-2xl border border-gray-100 hover:border-[#00A3FF]/25 hover:shadow-lg hover:shadow-[#00A3FF]/5 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/8 flex items-center justify-center mb-4 group-hover:bg-[#00A3FF]/14 transition-colors">
                  <Icon className="w-5 h-5 text-[#00A3FF]" />
                </div>
                <p className="font-semibold text-[#0F172A] mb-1">{label}</p>
                <p className="text-xs text-[#64748B] leading-relaxed">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <section className="bg-[#0F172A] py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">Security first</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Enterprise-grade protection,<br className="hidden sm:block" /> zero setup
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-2xl bg-white/5 border border-white/8 hover:border-[#00A3FF]/30 hover:bg-white/8 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/12 border border-[#00A3FF]/20 flex items-center justify-center mb-4 group-hover:bg-[#00A3FF]/20 transition-colors">
                  <Icon className="w-5 h-5 text-[#00A3FF]" />
                </div>
                <h3 className="font-semibold text-white mb-2 tracking-tight">{title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="bg-[#00A3FF] py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to collect client data securely?
          </h2>
          <p className="text-white/75 text-lg mb-10 leading-relaxed">
            Join professionals who trust SecureLink to handle their most sensitive client data.
          </p>
          <div className="flex justify-center">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
                if (!email) return;
                try {
                  const res = await fetch("/api/auth/check-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  const data = await res.json();
                  const encoded = encodeURIComponent(email);
                  window.location.href = data.exists
                    ? `/auth?email=${encoded}`
                    : `/auth?mode=signup&email=${encoded}`;
                } catch {
                  window.location.href = `/auth?mode=signup&email=${encodeURIComponent(email)}`;
                }
              }}
              className="flex flex-col sm:flex-row gap-3 w-full max-w-md"
            >
              <input
                type="email"
                name="email"
                placeholder="name@company.com"
                required
                className="flex-1 h-12 px-5 rounded-xl border border-white/30 bg-white/15 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent text-base"
              />
              <button
                type="submit"
                className="h-12 px-7 bg-white hover:bg-gray-50 text-[#00A3FF] font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0 text-base"
              >
                Start Free <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
          <p className="text-xs text-white/45 mt-4">No credit card required · Free to start</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#0A1120] py-12 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-10 mb-10">
            <div>
              <BrandLogo size="sm" />
              <p className="text-xs text-white/30 mt-3 max-w-[200px] leading-relaxed">
                Secure data collection for modern professionals.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Product</p>
                <div className="flex flex-col gap-2">
                  <Link href="/how-it-works" className="text-xs text-white/35 hover:text-white/70 transition-colors">How It Works</Link>
                  <Link href="/auth?mode=signup" className="text-xs text-white/35 hover:text-white/70 transition-colors">Get Started</Link>
                  <Link href="/auth" className="text-xs text-white/35 hover:text-white/70 transition-colors">Sign In</Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Company</p>
                <div className="flex flex-col gap-2">
                  <Link href="/about" className="text-xs text-white/35 hover:text-white/70 transition-colors">About</Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Legal</p>
                <div className="flex flex-col gap-2">
                  <Link href="/terms" className="text-xs text-white/35 hover:text-white/70 transition-colors">Terms &amp; Conditions</Link>
                  <Link href="/privacy" className="text-xs text-white/35 hover:text-white/70 transition-colors">Privacy Policy</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/20">© 2026 SecureLink. All rights reserved.</p>
            <p className="text-xs text-white/20 text-center sm:text-right max-w-sm leading-relaxed">
              Not a legal compliance product. Consult your compliance officer regarding applicable regulations.
            </p>
          </div>
        </div>
      </footer>

    </main>
  );
}
