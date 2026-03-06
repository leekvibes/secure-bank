/**
 * Email via Resend. Gracefully no-ops if RESEND_API_KEY is not set.
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in your .env to enable.
 */

import { Resend } from "resend";

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Secure Link <no-reply@mysecurelink.co>";

interface SubmissionNotificationArgs {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  linkType: string;
  submissionId: string;
  appUrl: string;
}

export async function sendSubmissionNotification(
  args: SubmissionNotificationArgs
): Promise<void> {
  const resend = getClient();
  if (!resend) return; // email not configured — silently skip

  const { agentEmail, agentName, clientName, linkType, submissionId, appUrl } =
    args;

  const typeLabels: Record<string, string> = {
    BANKING_INFO: "Banking Information",
    SSN_DOB: "SSN / Date of Birth",
    SSN_ONLY: "SSN (Secure)",
    FULL_INTAKE: "Full Intake",
  };
  const typeLabel = typeLabels[linkType] ?? linkType;
  const clientLabel = clientName ?? "a client";
  const viewUrl = `${appUrl}/dashboard/submissions/${submissionId}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: agentEmail,
      subject: `New secure submission from ${clientLabel}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
          <div style="background: #2563eb; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
            <span style="color: white; font-size: 18px;">&#128274;</span>
          </div>
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700;">New submission received</h2>
          <p style="margin: 0 0 24px; color: #64748b; font-size: 15px;">
            Hi ${agentName}, ${clientLabel} has securely submitted their ${typeLabel}.
          </p>
          <a href="${viewUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            View submission
          </a>
          <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
            This submission is encrypted at rest. You will need to reveal it in your dashboard to view the contents.
            Data is automatically deleted according to your retention settings.
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Never throw from email — don't break the submission flow
    console.error("[email] Failed to send submission notification:", err);
  }
}

interface PasswordResetArgs {
  toEmail: string;
  toName: string;
  resetUrl: string;
}

interface SendLinkEmailArgs {
  toEmail: string;
  agentName: string;
  message: string;
}

export async function sendPasswordResetEmail(
  args: PasswordResetArgs
): Promise<void> {
  const resend = getClient();
  if (!resend) return;

  const { toEmail, toName, resetUrl } = args;

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: "Reset your Secure Link password",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700;">Reset your password</h2>
          <p style="margin: 0 0 24px; color: #64748b; font-size: 15px;">
            Hi ${toName}, click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Reset password
          </a>
          <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. Your password will not change.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[email] Failed to send password reset:", err);
  }
}

export async function sendSecureLinkEmail(
  args: SendLinkEmailArgs
): Promise<{ success: boolean; error?: string }> {
  const resend = getClient();
  if (!resend) {
    return { success: false, error: "Email is not configured on this server." };
  }

  const { toEmail, agentName, message } = args;
  const html = message
    .split("\n")
    .map((line) => line.trim())
    .join("<br />");

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `${agentName} sent you a secure link`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <p style="margin: 0 0 12px;">${html}</p>
          <p style="margin: 18px 0 0; color: #64748b; font-size: 12px;">
            This secure link may expire. Please complete it as soon as possible.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed.";
    console.error("[email] Failed to send secure link:", msg);
    return { success: false, error: msg };
  }
}
