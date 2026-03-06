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
      photoUrl: true,
      licenseNumber: true,
      licensedStates: true,
    },
  });

  if (!agent) notFound();

  const states = agent.licensedStates
    ? agent.licensedStates.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const initials = agent.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,93%)] px-4 py-12">
      <div className="max-w-md mx-auto animate-fade-in">

        <div className="text-center mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase text-blue-600">Secure Link</p>
          <p className="text-xs text-muted-foreground mt-1">Agent Verification</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {agent.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agent.photoUrl}
                alt={agent.displayName}
                className="w-14 h-14 rounded-xl object-cover shadow-sm ring-2 ring-blue-100"
              />
            ) : (
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ring-2 ring-blue-100">
                {initials}
              </div>
            )}
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
              <a href={`tel:${agent.phone}`} className="flex items-center gap-2 text-foreground hover:text-blue-600 transition-colors">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {agent.phone}
              </a>
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
            What Is a Secure Link?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            A Secure Link is a private, encrypted form that your agent sends to
            you during your application process. Instead of sharing sensitive
            information over the phone &mdash; such as your Social Security
            Number or banking details &mdash; you enter it directly into a secure
            form on your own device.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your information is delivered directly to your agent, encrypted, and
            is never visible to anyone else.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
          <h2 className="font-bold text-foreground mb-4">How Your Information Is Protected</h2>
          <div className="space-y-4">
            {[
              {
                icon: Lock,
                title: "AES-256 Encryption",
                desc: "Each field is individually encrypted before it reaches our servers, ensuring your data is protected at every step.",
              },
              {
                icon: Clock,
                title: "Automatic Expiration",
                desc: "Every link is valid for a limited time only. Once it expires, it can no longer be accessed or used.",
              },
              {
                icon: Eye,
                title: "One-Time Reveal",
                desc: "By default, your agent can only view your information once. After that, the data is permanently masked.",
              },
              {
                icon: Shield,
                title: "Limited Retention",
                desc: "Your data is automatically and permanently deleted after a short retention period. Nothing is kept longer than necessary.",
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
          This page is for verification purposes only. Secure Link does
          not make legal compliance claims. If you have concerns about sharing
          your information, please discuss them directly with your agent.
        </p>
      </div>
    </main>
  );
}
