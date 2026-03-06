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
    <main className="min-h-screen bg-gradient-to-b from-white to-[hsl(210,25%,96%)] text-foreground overflow-hidden">
      <div className="relative z-10">
        <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <Lock className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">Agent Secure Links</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth?mode=signup">Get started</Link>
            </Button>
          </div>
        </nav>

        <section className="max-w-6xl mx-auto px-6 pt-20 pb-28 sm:pt-28 sm:pb-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 mb-8 animate-fade-in">
              <Fingerprint className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary tracking-wide uppercase">End-to-end encrypted</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-7 animate-slide-up">
              <span className="text-foreground">Collect sensitive data</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-500 to-cyan-500 bg-clip-text text-transparent">without the risk.</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Generate a secure, expiring link. Your client opens it privately
              and submits their information. You receive it encrypted in your
              dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button size="lg" asChild className="text-base px-8">
                <Link href="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="text-base px-8">
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
                className="group relative p-6 rounded-2xl bg-card border border-border transition-all duration-300 hover:border-primary/25 hover:shadow-lg animate-slide-up"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/12 flex items-center justify-center mb-4 transition-colors duration-300 group-hover:bg-primary/12">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 tracking-tight">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="max-w-6xl mx-auto px-6 pb-12">
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground/60 font-medium">Agent Secure Links</span>
            </div>
            <p className="text-xs text-muted-foreground/50 text-center sm:text-right max-w-lg leading-relaxed">
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
