import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { Shield, Lock, Clock, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-16">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-800">Agent Secure Links</span>
        </div>

        {/* Hero */}
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-6">
            Your clients shouldn't have to read sensitive info aloud.
          </h1>
          <p className="text-xl text-slate-500 mb-10 leading-relaxed">
            Generate a secure, expiring link. Your client opens it on their
            phone and privately submits their information. You receive it
            encrypted in your dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg">
              <Link href="/auth?mode=signup">Get started free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/auth">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* Trust signals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-20">
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
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-4 p-5 bg-white rounded-xl border border-slate-100 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-16 text-center">
          Agent Secure Links does not store data longer than your configured retention period.
          This tool assists with secure data collection; it is not a legal compliance product.
          Consult your compliance officer regarding applicable regulations.
        </p>
      </div>
    </main>
  );
}
