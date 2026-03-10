/**
 * Email via Resend.
 * All emails use the shared branded template (dark header, white body, gray footer).
 * Gracefully no-ops if RESEND_API_KEY is not set.
 */

import { Resend } from "resend";

// ── Client ────────────────────────────────────────────────────────────────────

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const APP_URL = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
const SUPPORT_EMAIL = "support@mysecurelink.co";
const FROM_TRANSACTIONAL = process.env.RESEND_FROM_EMAIL ?? "Secure Link <no-reply@mysecurelink.co>";
const FROM_SECURITY = "Secure Link Security <security@mysecurelink.co>";
const FROM_NOTIFICATIONS = "Secure Link <notifications@mysecurelink.co>";
const LOGO_URL = `${APP_URL}/logo.svg`;

// ── Shared HTML Template ──────────────────────────────────────────────────────

function emailTemplate({
  heading,
  body,
  ctaLabel,
  ctaUrl,
  notice,
  fromSecurity = false,
}: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  notice?: string;
  fromSecurity?: boolean;
}): string {
  const ctaButton = ctaLabel && ctaUrl
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${ctaUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#00A3FF,#0057FF);
                  color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;
                  font-weight:700;font-size:15px;letter-spacing:0.3px;
                  font-family:system-ui,-apple-system,sans-serif;">
          ${ctaLabel}
        </a>
       </div>`
    : "";

  const noticeBlock = notice
    ? `<div style="background:#F0F7FF;border-left:4px solid #0057FF;border-radius:4px;
                   padding:14px 18px;margin:24px 0;">
         <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">${notice}</p>
       </div>`
    : "";

  const securityNote = fromSecurity
    ? `<p style="margin:24px 0 0;font-size:12px;color:#94A3B8;text-align:center;line-height:1.6;">
         Secure Link will never ask for your password, banking information, or SSN via email.<br/>
         If you did not request this, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a> immediately.
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0D1117;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="Secure Link" height="52" style="display:block;margin:0 auto;"/>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:40px 48px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">
                ${heading}
              </h1>
              <div style="font-size:15px;color:#475569;line-height:1.7;">
                ${body}
              </div>
              ${ctaButton}
              ${noticeBlock}
              ${securityNote}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;border-radius:0 0 12px 12px;
                        padding:24px 48px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#94A3B8;">
                © ${new Date().getFullYear()} Secure Link &nbsp;·&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;text-decoration:none;">Support</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}" style="color:#0057FF;text-decoration:none;">mysecurelink.co</a>
              </p>
              <p style="margin:0;font-size:11px;color:#CBD5E1;line-height:1.6;">
                Secure Link assists with encrypted data collection. It is not a legal compliance product.<br/>
                Consult your compliance officer regarding applicable regulations.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function send(args: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  const resend = getClient();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: args.from ?? FROM_TRANSACTIONAL,
      to: args.to,
      subject: args.subject,
      replyTo: args.replyTo ?? SUPPORT_EMAIL,
      html: args.html,
    });
  } catch (err) {
    console.error(`[email] Failed to send "${args.subject}":`, err);
  }
}

// ── 1. Email Verification ─────────────────────────────────────────────────────

export async function sendEmailVerification(args: {
  toEmail: string;
  firstName: string;
  verifyUrl: string;
}): Promise<void> {
  const { toEmail, firstName, verifyUrl } = args;
  await send({
    to: toEmail,
    subject: "Verify your Secure Link email address",
    html: emailTemplate({
      heading: "Verify your email address",
      body: `<p>Hi ${firstName},</p>
             <p>Thanks for creating a Secure Link account. Click the button below to verify your email address and activate your account.</p>
             <p>This verification link expires in <strong>24 hours</strong>.</p>`,
      ctaLabel: "Verify Email Address",
      ctaUrl: verifyUrl,
      notice: "If you did not create a Secure Link account, you can safely ignore this email. No account will be created without verification.",
      fromSecurity: true,
    }),
  });
}

// ── 2. Welcome ────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(args: {
  toEmail: string;
  firstName: string;
}): Promise<void> {
  const { toEmail, firstName } = args;
  await send({
    to: toEmail,
    subject: "Welcome to Secure Link",
    html: emailTemplate({
      heading: `Welcome, ${firstName}.`,
      body: `<p>Your account is verified and ready. Secure Link lets you collect sensitive information from clients — banking details, SSNs, ID documents — through encrypted, expiring links.</p>
             <p>Here's how to get started:</p>
             <ol style="padding-left:20px;color:#475569;">
               <li style="margin-bottom:8px;">Complete your profile and upload your logo</li>
               <li style="margin-bottom:8px;">Create your first secure request link</li>
               <li style="margin-bottom:8px;">Send it to your client and receive their submission encrypted</li>
             </ol>`,
      ctaLabel: "Go to Dashboard",
      ctaUrl: `${APP_URL}/dashboard`,
    }),
  });
}

// ── 3. Password Reset Request ─────────────────────────────────────────────────

export async function sendPasswordResetEmail(args: {
  toEmail: string;
  toName: string;
  resetUrl: string;
}): Promise<void> {
  const { toEmail, toName, resetUrl } = args;
  await send({
    to: toEmail,
    from: FROM_SECURITY,
    subject: "Reset your Secure Link password",
    html: emailTemplate({
      heading: "Reset your password",
      body: `<p>Hi ${toName},</p>
             <p>We received a request to reset your Secure Link password. Click below to choose a new one.</p>
             <p>This link expires in <strong>1 hour</strong>.</p>`,
      ctaLabel: "Reset Password",
      ctaUrl: resetUrl,
      notice: "If you did not request a password reset, you can safely ignore this email. Your password will not change.",
      fromSecurity: true,
    }),
  });
}

// ── 4. Password Changed Confirmation ─────────────────────────────────────────

export async function sendPasswordChangedEmail(args: {
  toEmail: string;
  toName: string;
  changedAt: string;
}): Promise<void> {
  const { toEmail, toName, changedAt } = args;
  await send({
    to: toEmail,
    from: FROM_SECURITY,
    subject: "Your Secure Link password was changed",
    html: emailTemplate({
      heading: "Password successfully changed",
      body: `<p>Hi ${toName},</p>
             <p>Your Secure Link password was changed on <strong>${changedAt}</strong>.</p>
             <p>If you made this change, no action is needed.</p>`,
      ctaLabel: "Contact Support",
      ctaUrl: `mailto:${SUPPORT_EMAIL}`,
      notice: "If you did not change your password, contact our support team immediately at support@mysecurelink.co. Your account may be compromised.",
      fromSecurity: true,
    }),
  });
}

// ── 6. New Sign-In Alert ──────────────────────────────────────────────────────

export async function sendSignInAlertEmail(args: {
  toEmail: string;
  toName: string;
  time: string;
  browser: string;
}): Promise<void> {
  const { toEmail, toName, time, browser } = args;
  await send({
    to: toEmail,
    from: FROM_SECURITY,
    subject: "New sign-in to your Secure Link account",
    html: emailTemplate({
      heading: "New sign-in detected",
      body: `<p>Hi ${toName},</p>
             <p>A new sign-in to your Secure Link account was detected:</p>
             <table style="width:100%;border-collapse:collapse;margin:16px 0;">
               <tr>
                 <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;width:40%;">Time</td>
                 <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${time}</td>
               </tr>
               <tr>
                 <td style="padding:10px 0;color:#94A3B8;font-size:13px;">Browser / Device</td>
                 <td style="padding:10px 0;color:#0F172A;font-size:13px;">${browser}</td>
               </tr>
             </table>
             <p>If this was you, no action is needed.</p>`,
      ctaLabel: "Secure My Account",
      ctaUrl: `${APP_URL}/dashboard/settings`,
      fromSecurity: true,
    }),
  });
}

// ── 7. Secure Request Delivery → Client ──────────────────────────────────────

export async function sendSecureLinkEmail(args: {
  toEmail: string;
  agentName: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getClient();
  if (!resend) return { success: false, error: "Email is not configured on this server." };

  const { toEmail, agentName, message } = args;
  const bodyHtml = message
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;">${line.trim()}</p>`)
    .join("");

  try {
    await resend.emails.send({
      from: FROM_TRANSACTIONAL,
      to: toEmail,
      replyTo: SUPPORT_EMAIL,
      subject: `${agentName} sent you a secure request`,
      html: emailTemplate({
        heading: "You have a secure request",
        body: bodyHtml,
        notice: "This secure link will expire. Please complete your submission as soon as possible. Secure Link will never ask you for your information via regular email.",
      }),
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed.";
    console.error("[email] Failed to send secure link:", msg);
    return { success: false, error: msg };
  }
}

// ── 9. Submitted Confirmation → Client ───────────────────────────────────────

export async function sendSubmissionConfirmationToClient(args: {
  toEmail: string;
  clientName: string;
  requestType: string;
  submittedAt: string;
  agentName: string;
}): Promise<void> {
  const { toEmail, clientName, requestType, submittedAt, agentName } = args;
  await send({
    to: toEmail,
    subject: "Your information was received securely",
    html: emailTemplate({
      heading: "Submission received",
      body: `<p>Hi ${clientName},</p>
             <p>Your <strong>${requestType}</strong> was securely submitted to <strong>${agentName}</strong> on ${submittedAt}.</p>
             <p>Your information is encrypted and can only be accessed by your agent. You do not need to take any further action.</p>`,
      notice: "Secure Link will never contact you asking to resubmit information or verify your details via email. If you receive such a request, do not respond — contact us at support@mysecurelink.co.",
    }),
  });
}

// ── 10. Request Opened → Agent ────────────────────────────────────────────────

export async function sendRequestOpenedNotification(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  requestType: string;
  openedAt: string;
  dashboardUrl: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, requestType, openedAt, dashboardUrl } = args;
  const clientLabel = clientName ?? "Your client";
  await send({
    to: agentEmail,
    from: FROM_NOTIFICATIONS,
    subject: `${clientLabel} opened your secure request`,
    html: emailTemplate({
      heading: "Request opened",
      body: `<p>Hi ${agentName},</p>
             <p><strong>${clientLabel}</strong> opened your <strong>${requestType}</strong> secure request at ${openedAt}.</p>
             <p>They have not yet submitted. You'll receive another notification when they do.</p>`,
      ctaLabel: "View Request",
      ctaUrl: dashboardUrl,
    }),
  });
}

// ── 11. Submission Received → Agent ──────────────────────────────────────────

export async function sendSubmissionNotification(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  linkType: string;
  submissionId: string;
  appUrl?: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, linkType, submissionId } = args;
  const typeLabels: Record<string, string> = {
    BANKING_INFO: "Banking Information",
    SSN_DOB: "SSN / Date of Birth",
    SSN_ONLY: "SSN (Secure)",
    FULL_INTAKE: "Full Intake",
    ID_UPLOAD: "ID Document Upload",
  };
  const typeLabel = typeLabels[linkType] ?? linkType;
  const clientLabel = clientName ?? "A client";
  const viewUrl = `${APP_URL}/dashboard/submissions/${submissionId}`;

  await send({
    to: agentEmail,
    from: FROM_NOTIFICATIONS,
    subject: `New submission from ${clientLabel}`,
    html: emailTemplate({
      heading: "New submission received",
      body: `<p>Hi ${agentName},</p>
             <p><strong>${clientLabel}</strong> has securely submitted their <strong>${typeLabel}</strong>.</p>
             <p>The data is encrypted at rest. Open your dashboard to reveal and review it.</p>`,
      ctaLabel: "View Submission",
      ctaUrl: viewUrl,
      notice: "This submission is encrypted. You will need to reveal it in your dashboard to view the contents.",
    }),
  });
}

// ── 12. Request Expired → Agent ───────────────────────────────────────────────

export async function sendRequestExpiredToAgent(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  requestType: string;
  expiredAt: string;
  resendUrl: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, requestType, expiredAt, resendUrl } = args;
  const clientLabel = clientName ?? "Your client";
  await send({
    to: agentEmail,
    from: FROM_NOTIFICATIONS,
    subject: `Secure request expired — ${clientLabel}`,
    html: emailTemplate({
      heading: "Request expired without submission",
      body: `<p>Hi ${agentName},</p>
             <p>The <strong>${requestType}</strong> secure request sent to <strong>${clientLabel}</strong> expired on ${expiredAt} without being completed.</p>
             <p>You can create a new request and resend it from your dashboard.</p>`,
      ctaLabel: "Create New Request",
      ctaUrl: resendUrl,
    }),
  });
}

// ── 13. Request Expired → Client ──────────────────────────────────────────────

export async function sendRequestExpiredToClient(args: {
  toEmail: string;
  clientName: string;
  agentName: string;
  requestType: string;
}): Promise<void> {
  const { toEmail, clientName, agentName, requestType } = args;
  await send({
    to: toEmail,
    subject: "Your secure request link has expired",
    html: emailTemplate({
      heading: "Your link has expired",
      body: `<p>Hi ${clientName},</p>
             <p>The <strong>${requestType}</strong> secure request from <strong>${agentName}</strong> has expired and is no longer accessible.</p>
             <p>Please contact your agent to request a new link.</p>`,
      notice: "For security, all Secure Link requests expire after a set period. Your agent can generate a new link at any time.",
    }),
  });
}

// ── 14. ID Upload Received → Agent ───────────────────────────────────────────

export async function sendIdUploadNotification(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  documentType: string;
  uploadedAt: string;
  viewUrl: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, documentType, uploadedAt, viewUrl } = args;
  const clientLabel = clientName ?? "A client";
  await send({
    to: agentEmail,
    from: FROM_NOTIFICATIONS,
    subject: `ID document received from ${clientLabel}`,
    html: emailTemplate({
      heading: "ID document upload received",
      body: `<p>Hi ${agentName},</p>
             <p><strong>${clientLabel}</strong> uploaded a <strong>${documentType}</strong> on ${uploadedAt}.</p>
             <p>The document is encrypted and stored securely. View it in your dashboard.</p>`,
      ctaLabel: "View Document",
      ctaUrl: viewUrl,
      notice: "ID documents are encrypted with AES-256-GCM before storage. Only you can access them through your authenticated dashboard.",
    }),
  });
}

// ── 15. ID Upload Confirmation → Client ──────────────────────────────────────

export async function sendIdUploadConfirmationToClient(args: {
  toEmail: string;
  clientName: string;
  documentType: string;
  uploadedAt: string;
  agentName: string;
}): Promise<void> {
  const { toEmail, clientName, documentType, uploadedAt, agentName } = args;
  await send({
    to: toEmail,
    subject: "Your document was received securely",
    html: emailTemplate({
      heading: "Document received",
      body: `<p>Hi ${clientName},</p>
             <p>Your <strong>${documentType}</strong> was securely uploaded to <strong>${agentName}</strong> on ${uploadedAt}.</p>
             <p>Your document is encrypted and can only be accessed by your agent. No further action is required.</p>`,
      notice: "Secure Link encrypts all uploaded documents before storage. We will never share your documents with third parties.",
    }),
  });
}

// ── 16. Submission Export → Agent ─────────────────────────────────────────────

export async function sendExportNotification(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  exportFormat: string;
  exportedAt: string;
  viewUrl: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, exportFormat, exportedAt, viewUrl } = args;
  const clientLabel = clientName ?? "a client";
  await send({
    to: agentEmail,
    from: FROM_SECURITY,
    subject: `Submission exported — ${clientLabel}`,
    html: emailTemplate({
      heading: "Submission data exported",
      body: `<p>Hi ${agentName},</p>
             <p>A submission from <strong>${clientLabel}</strong> was exported as <strong>${exportFormat.toUpperCase()}</strong> on ${exportedAt}.</p>
             <p>This is a security notice confirming the export was performed under your account.</p>`,
      ctaLabel: "View Submission",
      ctaUrl: viewUrl,
      fromSecurity: true,
    }),
  });
}

// ── 17. Data Revealed → Agent ─────────────────────────────────────────────────

export async function sendRevealNotification(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  revealedAt: string;
  viewUrl: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, revealedAt, viewUrl } = args;
  const clientLabel = clientName ?? "a client";
  await send({
    to: agentEmail,
    from: FROM_SECURITY,
    subject: `Sensitive data revealed — ${clientLabel}`,
    html: emailTemplate({
      heading: "Encrypted data was revealed",
      body: `<p>Hi ${agentName},</p>
             <p>Encrypted submission data for <strong>${clientLabel}</strong> was revealed on ${revealedAt}.</p>
             <p>This is an automatic security notice logged to your audit trail.</p>`,
      ctaLabel: "View Submission",
      ctaUrl: viewUrl,
      fromSecurity: true,
    }),
  });
}
