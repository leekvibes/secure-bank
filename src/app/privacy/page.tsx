import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = { title: "Privacy Policy — SecureLink" };

const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: "Overview",
    body: "SecureLink provides encrypted request workflows for licensed professionals to collect sensitive client information safely. This Privacy Policy explains what we collect, how we use it, how we store it, and your choices.",
  },
  {
    heading: "Information We Collect",
    body: "We collect account information such as name, email address, agency or company details, and authentication data. We also process form submissions and uploaded files that users request from their clients, including sensitive fields configured by the user. We store audit activity such as request creation, opens, submissions, reveals, and exports. If enabled by account settings, we may also store IP address and user-agent information in audit logs.",
  },
  {
    heading: "How We Use Information",
    body: "We use data to provide, secure, and improve the service. This includes authenticating users, delivering secure links, encrypting and storing submissions, displaying dashboard records, generating audit history, sending transactional emails and alerts, enforcing abuse controls, and meeting legal or security obligations.",
  },
  {
    heading: "How Information Is Stored",
    body: "Sensitive submitted fields are encrypted at rest using AES-256. Uploaded files are encrypted before storage and may be stored in Vercel Blob infrastructure for managed file handling. We apply access controls so account holders can only access data associated with their own account and authorized workflows.",
  },
  {
    heading: "Data Sharing",
    body: "We do not sell personal information. We only share data with service providers needed to operate SecureLink, such as hosting, email delivery, SMS delivery, and managed infrastructure providers. These providers process information under contractual obligations to support our services.",
  },
  {
    heading: "Data Retention",
    body: "Retention is user-configurable, with a default of 30 days for supported workflows. Users may select different retention settings where available. Data may be deleted automatically after the configured retention period or earlier if deleted by the user.",
  },
  {
    heading: "Cookies and Session Data",
    body: "SecureLink uses essential session cookies for authentication and account security. We do not rely on advertising cookies for third-party ad targeting. Session and security cookies are used only to operate and protect the service.",
  },
  {
    heading: "User Rights and Controls",
    body: "Users can request deletion of account data, export of available records, and updates to account details. Depending on applicable law, additional rights may include access, correction, and objection to processing. To submit a privacy request, contact us using the support channel listed below.",
  },
  {
    heading: "Security Practices",
    body: "We use industry-standard safeguards including encryption, access controls, audit logging, and rate-limiting controls to reduce misuse and unauthorized access. No system is perfectly secure, but we continuously work to protect platform and customer data.",
  },
  {
    heading: "Contact Information",
    body: "For privacy questions or requests, contact SecureLink support through the contact details provided on our website.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="We take your privacy seriously. Here's exactly what we collect, how we use it, and how we protect it."
      updatedAt="March 2026"
      sections={SECTIONS}
    />
  );
}
