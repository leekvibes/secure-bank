"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock, Shield, ArrowRight, CheckCircle, FileText, CreditCard,
  Building2, Loader2, X, PenLine, Upload, Fingerprint, Zap,
  Star, ChevronRight, Eye, Clock,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

function EmailCTA({ size = "md", dark = false }: { size?: "sm" | "md"; dark?: boolean }) {
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
      router.push(data.exists ? `/auth?email=${encoded}` : `/auth?mode=signup&email=${encoded}`);
    } catch {
      router.push(`/auth?mode=signup&email=${encodeURIComponent(email.trim())}`);
    }
  }

  const h = size === "sm" ? "h-10" : "h-12";
  const inputBg = dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-[#00A3FF]/60" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#00A3FF]/40";
  const btnBg = dark ? "bg-[#00A3FF] hover:bg-[#0091E6] text-white" : "bg-[#00A3FF] hover:bg-[#0091E6] text-white";

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com" required
          className={`flex-1 ${h} px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent ${inputBg}`} />
        <button type="submit" disabled={loading}
          className={`${h} px-6 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 ${btnBg}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Start Free {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
      <p className="mt-2.5 text-[11px] text-gray-400 leading-relaxed">
        By clicking Start Free, you agree to SecureLink&apos;s{" "}
        <Link href="/terms" className="underline hover:text-gray-600 transition-colors">Terms and Conditions</Link>
        {" "}and{" "}
        <Link href="/privacy" className="underline hover:text-gray-600 transition-colors">Privacy Policy</Link>
      </p>
    </div>
  );
}

// ── Fake product mockup ───────────────────────────────────────────────────────
function ProductMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      {/* Glow behind */}
      <div className="absolute -inset-4 bg-[#00A3FF]/10 rounded-3xl blur-2xl" />

      {/* Browser chrome */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
        {/* Browser bar */}
        <div className="bg-[#1E293B] px-4 py-3 flex items-center gap-3 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-amber-400/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
          </div>
          <div className="flex-1 bg-[#0F172A] rounded-md px-3 py-1 flex items-center gap-2">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] text-white/40">mysecurelink.co/secure/xK9mP...</span>
          </div>
        </div>

        {/* Page content */}
        <div className="bg-gradient-to-b from-blue-50 to-white">
          {/* Trust header */}
          <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#00A3FF]/10 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-[#00A3FF]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-800">Alex Rivera · Rivera Insurance</p>
                <p className="text-[9px] text-gray-400">Licensed Agent · ID Verified</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-600 font-medium">Secure</span>
            </div>
          </div>

          {/* Form */}
          <div className="px-5 pt-4 pb-5 space-y-3">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl px-4 py-3 flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-white shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-white">Secure Banking Information</p>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 leading-relaxed">
              Hello, John. Please complete the form below to securely submit your banking information.
            </p>

            <div className="space-y-2">
              {[
                { label: "Full Name", val: "John Smith", type: "text" },
                { label: "Routing Number", val: "021000021", type: "text", badge: "✓ Chase Bank" },
                { label: "Account Number", val: "••••••••••", type: "password" },
              ].map(({ label, val, badge }) => (
                <div key={label}>
                  <p className="text-[9px] text-gray-500 mb-1 font-medium">{label}</p>
                  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-gray-700">{val}</span>
                    {badge && <span className="text-[9px] text-emerald-600 font-medium">{badge}</span>}
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg py-2.5 text-[11px] font-semibold">
              Submit Securely
            </button>

            <p className="text-[9px] text-gray-400 text-center">
              🔒 256-bit encrypted · View once · Link expires in 23h
            </p>
          </div>
        </div>
      </div>

      {/* Floating notification */}
      <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2.5 flex items-center gap-2.5 max-w-[180px]">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-800">Submitted!</p>
          <p className="text-[9px] text-gray-400">Data encrypted & delivered</p>
        </div>
      </div>
    </div>
  );
}

// ── Old way vs SecureLink comparison ─────────────────────────────────────────
const OLD_WAY = [
  "Texting SSNs and bank accounts",
  "Emailing sensitive PDFs unencrypted",
  "Hoping clients don't screenshot",
  "No record of who saw what",
  "Clients confused with long email chains",
  "Zero compliance trail",
];

const NEW_WAY = [
  "Encrypted link, no data in transit",
  "AES-256 encrypted at rest",
  "View-once — data masked after reveal",
  "Full audit log of every action",
  "One link, mobile-friendly, no app needed",
  "Timestamped audit trail built in",
];

// ── Social proof numbers ──────────────────────────────────────────────────────
const STATS = [
  { n: "256-bit", label: "AES encryption on every field" },
  { n: "< 30s", label: "To send a secure request" },
  { n: "0", label: "Sensitive data stored in plaintext" },
  { n: "24/7", label: "Audit log of every action" },
];

// ── Feature highlights ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: CreditCard,
    title: "Banking Info",
    desc: "Collect routing + account numbers with instant bank verification and confirmation fields.",
    color: "#3B82F6",
  },
  {
    icon: Shield,
    title: "SSN & Identity",
    desc: "Masked SSN entry with confirmation. Clients feel safe — you get accurate data.",
    color: "#8B5CF6",
  },
  {
    icon: Upload,
    title: "Document Upload",
    desc: "Scan any document — driver's license, passport, SSN card, birth certificate — photo or PDF.",
    color: "#F59E0B",
  },
  {
    icon: PenLine,
    title: "E-Signatures",
    desc: "Send documents for signature. Place fields, client signs, PDF gets finalized.",
    color: "#10B981",
  },
  {
    icon: FileText,
    title: "Custom Forms",
    desc: "Build your own intake forms with any field type. Generate shareable secure links instantly.",
    color: "#EC4899",
  },
  {
    icon: Zap,
    title: "File Transfers",
    desc: "Send files securely to clients. View-once, expiring, encrypted — better than WeTransfer.",
    color: "#00A3FF",
  },
];

const USE_CASES = [
  { icon: Building2, label: "Insurance Agents",     sub: "Policy forms, IDs & banking info" },
  { icon: CreditCard, label: "Mortgage Brokers",    sub: "SSNs, income docs & bank accounts" },
  { icon: FileText,   label: "Real Estate",         sub: "Earnest money details & ID uploads" },
  { icon: Shield,     label: "Financial Advisors",  sub: "Secure onboarding & KYC compliance" },
];

const TESTIMONIALS = [
  {
    quote: "I used to text my clients asking for their SSN. That was terrifying in hindsight. SecureLink changed how I work completely.",
    name: "Marcus T.",
    role: "Independent Insurance Agent",
    stars: 5,
  },
  {
    quote: "My clients actually trust the process more now. They see the encryption, the verified agent badge, and they feel safe.",
    name: "Priya S.",
    role: "Mortgage Loan Officer",
    stars: 5,
  },
  {
    quote: "Setup took 5 minutes. Now I send a link instead of an email chain and my clients think I'm running a major firm.",
    name: "James R.",
    role: "Real Estate Broker",
    stars: 5,
  },
];

export function HomePageClient() {
  return (
    <main className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 border-b border-gray-100 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/"><BrandLogo size="sm" /></Link>
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/how-it-works" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">How it works</Link>
            <Link href="/about" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/auth?mode=signup"
              className="text-sm font-semibold bg-[#0F172A] hover:bg-[#1E293B] text-white px-5 py-2 rounded-lg transition-colors">
              Start Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#0F172A] pt-20 pb-32 px-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(#00A3FF 1px,transparent 1px),linear-gradient(90deg,#00A3FF 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00A3FF]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00A3FF]/10 border border-[#00A3FF]/20 mb-7">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00A3FF] animate-pulse" />
                <span className="text-xs font-medium text-[#00A3FF]">Trusted by real estate, financing &amp; legal professionals</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
                Everything you need to securely collect{" "}
                <span className="text-[#00A3FF]">client information</span>
              </h1>

              <p className="text-lg text-white/55 leading-relaxed mb-8 max-w-lg">
                Send encrypted requests for banking details, documents, and signatures — in seconds.
              </p>

              <EmailCTA dark />

              <div className="flex flex-wrap items-center gap-5 mt-8">
                {["Free to start", "No app for clients", "Full audit trail"].map((t) => (
                  <div key={t} className="flex items-center gap-1.5 text-sm text-white/40">
                    <CheckCircle className="w-3.5 h-3.5 text-[#00A3FF]/60 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <ProductMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <section className="bg-[#00A3FF] py-10 px-5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map(({ n, label }) => (
            <div key={n} className="text-center">
              <p className="text-2xl sm:text-3xl font-black text-white mb-1">{n}</p>
              <p className="text-xs text-white/70 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="bg-[#0F172A] py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              From request to received in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-transparent via-[#00A3FF]/40 to-transparent" />
            {[
              { n: "1", title: "Build your request form", desc: "Choose what to collect — banking info, IDs, signatures, or custom fields. Takes 30 seconds." },
              { n: "2", title: "Send a secure link", desc: "Copy the link or send it by text. Your client opens it on any device, no account needed." },
              { n: "3", title: "Receive encrypted data", desc: "Data arrives in your dashboard, encrypted and ready to reveal when you need it." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col items-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[#00A3FF] flex items-center justify-center mb-6 shadow-lg shadow-[#00A3FF]/30">
                  <span className="text-2xl font-black text-white">{n}</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────────────── */}
      <section className="bg-[#F8FAFC] py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
              One platform. Every sensitive request.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title}
                className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: color + "15" }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">Built for your industry</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
              Trusted by professionals who handle sensitive data daily
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {USE_CASES.map(({ icon: Icon, label, sub }) => (
              <div key={label}
                className="p-6 rounded-2xl border border-gray-100 hover:border-[#00A3FF]/20 hover:shadow-lg transition-all duration-300 group text-center">
                <div className="w-12 h-12 rounded-xl bg-[#00A3FF]/8 flex items-center justify-center mb-4 mx-auto group-hover:bg-[#00A3FF]/15 transition-colors">
                  <Icon className="w-6 h-6 text-[#00A3FF]" />
                </div>
                <p className="font-bold text-[#0F172A] mb-1.5">{label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="bg-[#F8FAFC] py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">What agents say</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
              Professionals love it
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, role, stars }) => (
              <div key={name} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">"{quote}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{name}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security callout ───────────────────────────────────────────────── */}
      <section className="bg-[#0F172A] py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: "AES-256-GCM Encrypted", desc: "Every field individually encrypted before storage. Plaintext never touches our servers." },
              { icon: Eye, title: "View Once", desc: "Sensitive data is masked after first reveal. Your client's data doesn't linger." },
              { icon: Clock, title: "Auto-Expiring", desc: "Links expire on your schedule. No lingering access, ever." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/8">
                <div className="w-9 h-9 rounded-xl bg-[#00A3FF]/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-[#00A3FF]" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-[#00A3FF] py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Your clients deserve better than a text message.
          </h2>
          <p className="text-white/80 text-lg mb-10 leading-relaxed">
            Start sending secure links today. Free to get started, no credit card required.
          </p>
          <div className="flex justify-center">
            <Link href="/auth?mode=signup"
              className="inline-flex items-center gap-2 h-14 px-10 bg-white hover:bg-gray-50 text-[#00A3FF] font-bold rounded-xl transition-colors text-base shadow-lg shadow-black/10">
              Create free account <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="text-xs text-white/40 mt-4">Free to start · No credit card · Setup in 2 minutes</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
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
                  <Link href="/terms" className="text-xs text-white/35 hover:text-white/70 transition-colors">Terms</Link>
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
