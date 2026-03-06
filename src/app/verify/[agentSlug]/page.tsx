import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Shield, Lock, Clock, Eye, CheckCircle2, MapPin, Phone } from "lucide-react";

interface Props {
  params: { agentSlug: string };
}

export default async function VerifyPage({ params }: Props) {
  const agent = await db.user.findUnique({
    where: { agentSlug: params.agentSlug },
    select: {
      displayName: true,
      agencyName: true,
      phone: true,
      licenseNumber: true,
      licensedStates: true,
    },
  });

  if (!agent) notFound();

  const states = agent.licensedStates
    ? agent.licensedStates.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,93%)] px-4 py-12">
      <div className="max-w-md mx-auto animate-fade-in">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {agent.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {agent.displayName}
              </h1>
              {agent.agencyName && (
                <p className="text-muted-foreground text-sm">{agent.agencyName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {agent.phone && (
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {agent.phone}
              </div>
            )}
            {agent.licenseNumber && (
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                License #{agent.licenseNumber}
              </div>
            )}
            {states.length > 0 && (
              <div className="flex items-start gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>Licensed in {states.join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
          <h2 className="font-bold text-foreground mb-3">
            What is a Secure Link?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            A secure link is a private, encrypted form that your agent sends to
            you during your application process. Instead of reading sensitive
            information aloud on a phone call -- such as your Social Security
            Number or banking details -- you type it directly into this secure
            form on your device.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your information goes directly to your agent, encrypted, and is
            never seen by anyone else.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
          <h2 className="font-bold text-foreground mb-4">How it&apos;s protected</h2>
          <div className="space-y-4">
            {[
              {
                icon: Lock,
                title: "AES-256 Encryption",
                desc: "Your data is encrypted individually for each field before it ever reaches our servers.",
              },
              {
                icon: Clock,
                title: "Links expire automatically",
                desc: "Each link is valid for a limited time only. Once it expires, it cannot be used again.",
              },
              {
                icon: Eye,
                title: "One-time reveal",
                desc: "By default, your agent can only reveal your data once. After that, fields are permanently masked.",
              },
              {
                icon: Shield,
                title: "Limited retention",
                desc: "Your data is automatically deleted after a short period. We keep it only as long as needed.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="w-8 h-8 bg-primary/8 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-primary/15">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60 text-center leading-relaxed px-2">
          This page is for verification purposes only. Agent Secure Links does
          not make legal compliance claims. If you have concerns about sharing
          your information, please discuss them directly with your agent.
        </p>
      </div>
    </main>
  );
}
