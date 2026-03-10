import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

interface Section {
  heading: string;
  body: string;
}

interface Props {
  title: string;
  subtitle: string;
  updatedAt?: string;
  sections?: Section[];
  children?: React.ReactNode;
}

export function LegalPageLayout({ title, subtitle, updatedAt, sections, children }: Props) {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/"><BrandLogo size="sm" /></Link>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign in</Link>
            <Link href="/auth?mode=signup" className="text-sm font-semibold bg-[#00A3FF] hover:bg-[#0091E6] text-white px-4 py-1.5 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-[#0F172A] py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-[#00A3FF] tracking-widest uppercase mb-3">SecureLink</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">{title}</h1>
          <p className="text-white/55 text-base leading-relaxed">{subtitle}</p>
          {updatedAt && (
            <p className="text-white/30 text-xs mt-4">Last updated: {updatedAt}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-5 py-14">
        {children ?? (
          <div className="space-y-10">
            {(sections ?? []).map((section, i) => (
              <div key={section.heading} className="group">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#00A3FF]/8 border border-[#00A3FF]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#00A3FF]">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-[#0F172A] mb-2 tracking-tight">{section.heading}</h2>
                    <p className="text-[#475569] leading-relaxed text-[15px]">{section.body}</p>
                  </div>
                </div>
                {i < (sections ?? []).length - 1 && <div className="mt-10 border-b border-gray-100" />}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0A1120] py-10 px-5 mt-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" />
          <div className="flex gap-6 text-xs text-white/35">
            <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
            <Link href="/about" className="hover:text-white/70 transition-colors">About</Link>
            <Link href="/how-it-works" className="hover:text-white/70 transition-colors">How It Works</Link>
          </div>
          <p className="text-xs text-white/20">© 2026 SecureLink. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
