import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = { title: "Terms & Conditions — SecureLink" };

const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: "Acceptance of Terms",
    body: "By creating an account, accessing, or using SecureLink, you agree to these Terms & Conditions. If you do not agree, do not use the service. These terms apply to all users, including licensed professionals and their authorized team members.",
  },
  {
    heading: "Description of Service",
    body: "SecureLink is a software platform that helps licensed professionals such as real estate agents, mortgage brokers, insurance agents, and financial advisors send encrypted links to clients for private data collection. The platform may collect sensitive details such as banking information, Social Security numbers, identity documents, and signatures through secure workflows.",
  },
  {
    heading: "Account Eligibility and Professional Use",
    body: "You are responsible for ensuring you are legally authorized to collect and process client information in your jurisdiction and industry. You agree to provide accurate account information, maintain the security of your login credentials, and use SecureLink only for lawful business purposes.",
  },
  {
    heading: "User Responsibilities",
    body: "You are responsible for all activity under your account, including links created, data requests sent, and submissions viewed or exported. You must keep your email, password, and account recovery details up to date and notify us promptly if you suspect unauthorized access.",
  },
  {
    heading: "Prohibited Uses",
    body: "You may not use SecureLink for fraud, harassment, unlawful surveillance, impersonation, unauthorized data collection, or to violate privacy, data protection, or financial regulations. You may not attempt to reverse engineer, interfere with, overload, or bypass security features of the service.",
  },
  {
    heading: "Data Handling and Privacy",
    body: "SecureLink encrypts submitted sensitive data using AES-256 at rest. Request links are designed to expire automatically. Data retention is controlled by user settings, and records are deleted after the configured retention period where applicable. Your use of the platform is also governed by our Privacy Policy.",
  },
  {
    heading: "Security and Availability",
    body: "We use commercially reasonable safeguards to protect platform integrity and confidentiality. However, no internet service can guarantee absolute security or uninterrupted availability. You agree that you are responsible for your own compliance obligations, internal controls, and incident response procedures.",
  },
  {
    heading: "Intellectual Property",
    body: "SecureLink and all related software, branding, content, features, and documentation are owned by SecureLink or its licensors and protected by intellectual property laws. You receive a limited, revocable, non-transferable right to use the service for your internal business operations.",
  },
  {
    heading: "Fees and Changes",
    body: "If paid plans are introduced or updated, pricing, feature limits, and billing terms may change with notice. We may modify, suspend, or discontinue parts of the service as needed for legal, operational, or security reasons.",
  },
  {
    heading: "Disclaimers",
    body: "SecureLink is provided on an \"as is\" and \"as available\" basis. To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. SecureLink is a software tool and does not provide legal, financial, insurance, or compliance advice.",
  },
  {
    heading: "Limitation of Liability",
    body: "To the fullest extent permitted by law, SecureLink and its affiliates will not be liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost data, or business interruption. Our aggregate liability for claims related to the service is limited to amounts paid by you to SecureLink in the 12 months preceding the claim.",
  },
  {
    heading: "Termination",
    body: "You may stop using SecureLink at any time. We may suspend or terminate access if we believe you violated these terms, created security risk, or used the service unlawfully. Termination does not remove obligations that by nature survive termination, including payment obligations, intellectual property terms, and liability limits.",
  },
  {
    heading: "Governing Law",
    body: "These Terms & Conditions are governed by the laws of the United States, without regard to conflict of law principles. You agree to resolve disputes in the applicable courts within the United States unless otherwise required by law.",
  },
  {
    heading: "Contact",
    body: "If you have questions about these terms, contact SecureLink support through the contact details listed on our website.",
  },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle="By using SecureLink, you agree to these terms. Please read them carefully."
      updatedAt="March 2026"
      sections={SECTIONS}
    />
  );
}
