import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = { title: "How It Works — SecureLink" };

const STEPS: Array<{ heading: string; body: string }> = [
  {
    heading: "Agent creates a secure request link",
    body: "Inside the dashboard, the agent creates a request and selects what to collect, such as banking details, SSN, ID upload, signature fields, or a custom form. The agent sets link expiration, can apply one-time or limited-access settings where supported, and can include trust context like destination labels and branded details.",
  },
  {
    heading: "Agent sends the link by text or email",
    body: "Once created, the secure link is sent to the client by email, text message, or copy/share flow. The agent can track send history in the dashboard so there is a clear record of when and how the request was delivered.",
  },
  {
    heading: "Client opens the link and submits privately",
    body: "The client opens the secure page and sees trust details such as the agent's name, business branding, and security messaging. The client completes the requested form — banking info, ID photos, signatures, or other intake fields — and submits through an encrypted workflow.",
  },
  {
    heading: "Agent receives encrypted submission",
    body: "After submission, the agent sees the request status update in the dashboard. Data remains encrypted at rest. When needed, the agent can reveal the data through authenticated dashboard flows and review activity history for operational and security visibility.",
  },
  {
    heading: "Data is retained and deleted by policy",
    body: "SecureLink applies the account's configured retention rules. Links expire automatically, and stored data is retained only for the selected window before deletion where policy-based cleanup is enabled.",
  },
];

const FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "Is client data encrypted?",
    answer: "Yes. Sensitive fields are encrypted at rest using AES-256, and uploads are encrypted before storage.",
  },
  {
    question: "Can I control how long data is kept?",
    answer: "Yes. Retention settings are configurable, and many workflows support automatic deletion after your selected window.",
  },
  {
    question: "Do links expire automatically?",
    answer: "Yes. Every request link has an expiration setting, and expired links cannot be used for new submissions.",
  },
  {
    question: "Can I see who opened or submitted a request?",
    answer: "Yes. Dashboard activity and audit records track key request events such as send, open, submit, reveal, and export actions.",
  },
  {
    question: "Can clients upload IDs and documents?",
    answer: "Yes. SecureLink supports ID upload workflows with encrypted storage and controlled access from the dashboard.",
  },
  {
    question: "Does SecureLink sell user data?",
    answer: "No. SecureLink does not sell personal information. Data is processed only to operate the platform and its supporting services.",
  },
  {
    question: "Who is SecureLink designed for?",
    answer: "It is built for licensed professionals and teams handling sensitive client onboarding data, including real estate, mortgage, insurance, and financial advisory workflows.",
  },
  {
    question: "What if a client's link expires?",
    answer: "The agent can issue a new secure link from the dashboard and resend it through the same secure delivery options.",
  },
];

export default function HowItWorksPage() {
  return (
    <LegalPageLayout
      title="How It Works"
      subtitle="Secure data collection from request to retention — simple for agents, safe for clients."
    >
      {/* Steps */}
      <div className="space-y-10 mb-16">
        {STEPS.map((step, i) => (
          <div key={step.heading} className="group">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-[#00A3FF]/8 border border-[#00A3FF]/15 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#00A3FF]">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-[#0F172A] mb-2 tracking-tight">{step.heading}</h2>
                <p className="text-[#475569] leading-relaxed text-[15px]">{step.body}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && <div className="mt-10 border-b border-gray-100" />}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-8">Frequently Asked Questions</h2>
        <div className="space-y-0 divide-y divide-gray-100">
          {FAQS.map((faq) => (
            <div key={faq.question} className="py-5">
              <p className="text-[15px] font-semibold text-[#0F172A] mb-1.5">{faq.question}</p>
              <p className="text-[#475569] leading-relaxed text-[15px]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </LegalPageLayout>
  );
}
