import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = { title: "About — SecureLink" };

const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: "Why SecureLink Exists",
    body: "Professionals often collect highly sensitive client data over phone calls, text messages, or email threads. That creates unnecessary risk for both the client and the business. SecureLink was built to replace that unsafe workflow with something private, structured, and trustworthy.",
  },
  {
    heading: "What We Built",
    body: "SecureLink lets licensed professionals send one-time secure request links to clients. Clients can submit banking details, Social Security information, identity documents, and signatures through encrypted flows instead of sharing data in plain text channels.",
  },
  {
    heading: "Who It Is For",
    body: "SecureLink is designed for licensed professionals including real estate agents, mortgage brokers, insurance agents, financial advisors, and teams that handle confidential client onboarding data.",
  },
  {
    heading: "Our Security Commitments",
    body: "We focus on practical security: AES-256 encryption at rest, auto-expiring links, configurable retention windows, and auditable request activity. Our goal is simple: give professionals a safer way to collect private client information and give clients confidence in the process.",
  },
];

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="About SecureLink"
      subtitle="Our mission is to give professionals a safer way to collect private client information."
      sections={SECTIONS}
    />
  );
}
