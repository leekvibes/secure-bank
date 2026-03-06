import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { Shield, Lock, Clock, Eye, ArrowRight, Fingerprint } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[hsl(222,30%,6%)] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(220,80%,20%,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(220,70%,30%,0.08),transparent_60%)]" />

      <div className="relative z-10">
        <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Lock className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-white/90">Agent Secure Links</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-white/60 hover:text-white hover:bg-white/5">
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20">
              <Link href="/auth?mode=signup">Get started</Link>
            </Button>
          </div>
        </nav>

        <section className="max-w-6xl mx-auto px-6 pt-20 pb-28 sm:pt-28 sm:pb-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8 animate-fade-in">
              <Fingerprint className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-300/90 tracking-wide uppercase">End-to-end encrypted</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-7 animate-slide-up">
              <span className="text-white">Collect sensitive data</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent">without the risk.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/45 leading-relaxed max-w-xl mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Generate a secure, expiring link. Your client opens it privately
              and submits their information. You receive it encrypted in your
              dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button size="lg" asChild className="bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/25 text-base px-8">
                <Link href="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white text-base px-8">
                <Link href="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Lock,
                title: "AES-256 Encrypted",
                desc: "Every field is encrypted individually before storage. Plaintext never touches our database.",
              },
              {
                icon: Clock,
                title: "Auto-Expiring Links",
                desc: "Links expire automatically. You set the window — default 24 hours.",
              },
              {
                icon: Eye,
                title: "View-Once by Default",
                desc: "Submissions are masked after first reveal. Data is deleted after your retention window.",
              },
              {
                icon: Shield,
                title: "Full Audit Trail",
                desc: "Every action — created, opened, submitted, revealed — is logged for your records.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06] hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 animate-slide-up"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center mb-4 transition-colors duration-300 group-hover:bg-blue-500/15 group-hover:border-blue-500/25">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white/90 mb-2 tracking-tight">{title}</h3>
                <p className="text-sm text-white/35 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="max-w-6xl mx-auto px-6 pb-12">
          <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-white/20" />
              <span className="text-sm text-white/25 font-medium">Agent Secure Links</span>
            </div>
            <p className="text-xs text-white/20 text-center sm:text-right max-w-lg leading-relaxed">
              Agent Secure Links does not store data longer than your configured retention period.
              This tool assists with secure data collection; it is not a legal compliance product.
              Consult your compliance officer regarding applicable regulations.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
