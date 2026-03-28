/**
 * Email via Resend.
 * All emails use the shared branded template (dark header, white body, gray footer).
 * Gracefully no-ops if RESEND_API_KEY is not set.
 */

import { Resend } from "resend";

// ── Config ────────────────────────────────────────────────────────────────────

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const APP_URL = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";
const SUPPORT_EMAIL = "support@mysecurelink.co";
// All transactional emails use the single verified sender configured in RESEND_FROM_EMAIL.
// Using multiple FROM addresses requires each one to be verified in Resend — using one
// address avoids deliverability issues.
const FROM_TRANSACTIONAL = process.env.RESEND_FROM_EMAIL ?? "Secure Link <no-reply@mysecurelink.co>";
const FROM_SECURITY = process.env.RESEND_FROM_EMAIL ?? "Secure Link <no-reply@mysecurelink.co>";
const FROM_NOTIFICATIONS = process.env.RESEND_FROM_EMAIL ?? "Secure Link <no-reply@mysecurelink.co>";
const LOGO_URL = `${APP_URL}/logo.svg`;

// ── Shared HTML Template ──────────────────────────────────────────────────────

function p(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;color:#475569;line-height:1.7;">${text}</p>`;
}

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
  const ctaButton =
    ctaLabel && ctaUrl
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
         If you did not initiate this action, contact
         <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a> immediately.
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

          <!-- Logo header -->
          <tr>
            <td style="background:#F8FAFC;border-radius:12px 12px 0 0;padding:44px 40px 40px;text-align:center;border-bottom:1px solid #E2E8F0;">
              <div style="display:inline-block;line-height:1;">
                <span style="font-family:system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#0F172A;">Secure</span><span style="font-family:system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#00A3FF;">Link</span>
              </div>
              <div style="margin-top:10px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3.5px;color:#00A3FF;">SECURE. SIMPLE. FAST.</div>
            </td>
          </tr>

          <!-- White body -->
          <tr>
            <td style="background:#FFFFFF;padding:40px 48px;">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;">
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

          <!-- Gray footer -->
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

// ── Shared sender ─────────────────────────────────────────────────────────────

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
  expiresIn?: string;
}): Promise<void> {
  const { toEmail, firstName, verifyUrl, expiresIn = "24 hours" } = args;
  await send({
    to: toEmail,
    subject: "Verify your email to secure your account",
    html: emailTemplate({
      heading: "Verify your email address",
      body:
        p(`Hi ${firstName},`) +
        p("Please verify your email address to finish setting up your account.") +
        p(`This link expires in <strong>${expiresIn}</strong>.`),
      ctaLabel: "Verify Email Address",
      ctaUrl: verifyUrl,
      notice: "If you didn't create this account, you can ignore this email. No account will be activated without verification.",
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
      body:
        p("Welcome aboard. Your account is ready, and you can start sending secure requests now.") +
        p("Here's how to get started:") +
        `<ol style="padding-left:20px;color:#475569;font-size:15px;line-height:1.8;margin:0 0 14px;">
           <li>Complete your profile and upload your logo</li>
           <li>Create your first secure request link</li>
           <li>Send it to your client and receive their submission encrypted</li>
         </ol>` +
        p(`If you need help getting started, reply to this email and we'll help you quickly.`),
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
      body:
        p(`Hi ${toName},`) +
        p("We received a request to reset your Secure Link password. Click the button below to choose a new one.") +
        p("This link expires in <strong>1 hour</strong>."),
      ctaLabel: "Reset Password",
      ctaUrl: resetUrl,
      notice: `If you didn't request this, you can safely ignore this email. Your password will not change.`,
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
    subject: "Your password was changed",
    html: emailTemplate({
      heading: "Password successfully changed",
      body:
        p(`Hi ${toName},`) +
        p(`Your password was successfully changed on <strong>${changedAt}</strong>.`) +
        p("If you made this change, no action is needed."),
      notice: `If you did not make this change, contact us immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a>. Your account may be at risk.`,
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
  ipApprox?: string;
}): Promise<void> {
  const { toEmail, toName, time, browser, ipApprox } = args;
  await send({
    to: toEmail,
    from: FROM_SECURITY,
    subject: "New sign-in detected on your account",
    html: emailTemplate({
      heading: "New sign-in detected",
      body:
        p(`Hi ${toName},`) +
        p("We detected a new sign-in to your account.") +
        `<table style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
           <tr>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;width:40%;">Time</td>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${time}</td>
           </tr>
           <tr>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;">Browser / Device</td>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${browser}</td>
           </tr>
           ${ipApprox ? `<tr>
             <td style="padding:10px 0;color:#94A3B8;font-size:13px;">Approximate Location</td>
             <td style="padding:10px 0;color:#0F172A;font-size:13px;">${ipApprox}</td>
           </tr>` : ""}
         </table>` +
        p("If this was you, no action is needed."),
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
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => p(line))
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
        notice: "This secure link will expire. Please complete your submission as soon as possible. Secure Link will never ask for your information via regular email.",
      }),
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed.";
    console.error("[email] Failed to send secure link:", msg);
    return { success: false, error: msg };
  }
}

// ── 8. Request Reminder → Client ─────────────────────────────────────────────

export async function sendRequestReminder(args: {
  toEmail: string;
  clientName: string;
  requestType: string;
  expiresAt: string;
  secureUrl: string;
  agentName: string;
}): Promise<void> {
  const { toEmail, clientName, requestType, expiresAt, secureUrl, agentName } = args;
  await send({
    to: toEmail,
    subject: `Reminder: your secure ${requestType} request expires soon`,
    html: emailTemplate({
      heading: "Don't forget — your secure request is waiting",
      body:
        p(`Hi ${clientName},`) +
        p(`This is a reminder from <strong>${agentName}</strong>: your secure <strong>${requestType}</strong> request will expire at <strong>${expiresAt}</strong>.`) +
        p(`If you need a new link after it expires, contact ${agentName} directly.`),
      ctaLabel: "Complete Secure Request",
      ctaUrl: secureUrl,
      notice: "Secure Link will never ask you to re-enter information via email. Always use the secure link provided.",
    }),
  });
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
    subject: `We received your secure ${requestType} submission`,
    html: emailTemplate({
      heading: "Your submission was received",
      body:
        p(`Hi ${clientName},`) +
        p(`Your secure <strong>${requestType}</strong> submission was received by <strong>${agentName}</strong> on <strong>${submittedAt}</strong>.`) +
        p("No further action is needed right now."),
      notice: `If you have questions, contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a>.`,
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
    subject: `${clientLabel} opened the secure ${requestType} request`,
    html: emailTemplate({
      heading: "Secure request opened",
      body:
        p(`Hi ${agentName},`) +
        p(`<strong>${clientLabel}</strong> opened the secure <strong>${requestType}</strong> request at <strong>${openedAt}</strong>.`) +
        p("They haven't submitted yet. You'll receive another notification when they do."),
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
      body:
        p(`Hi ${agentName},`) +
        p(`<strong>${clientLabel}</strong> has securely submitted their <strong>${typeLabel}</strong>.`) +
        p("The data is encrypted at rest. Open your dashboard to reveal and review it."),
      ctaLabel: "View Submission",
      ctaUrl: viewUrl,
      notice: "Submissions are encrypted with AES-256-GCM. You will need to reveal the data in your dashboard to view it.",
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
    subject: `Secure ${requestType} request expired for ${clientLabel}`,
    html: emailTemplate({
      heading: "Secure request expired",
      body:
        p(`Hi ${agentName},`) +
        p(`The secure <strong>${requestType}</strong> request for <strong>${clientLabel}</strong> expired at <strong>${expiredAt}</strong> without being completed.`) +
        p("You can send a new request from your dashboard."),
      ctaLabel: "Send New Request",
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
    subject: `Your secure ${requestType} link has expired`,
    html: emailTemplate({
      heading: "Your secure link has expired",
      body:
        p(`Hi ${clientName},`) +
        p(`Your secure <strong>${requestType}</strong> link from <strong>${agentName}</strong> has expired and is no longer accessible.`) +
        p(`Please contact <strong>${agentName}</strong> to request a new secure link.`),
      notice: `For help, email <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a>.`,
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
    subject: `ID upload received from ${clientLabel}`,
    html: emailTemplate({
      heading: "ID document received",
      body:
        p(`Hi ${agentName},`) +
        p(`An ID upload was received from <strong>${clientLabel}</strong>.`) +
        `<table style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
           <tr>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;width:40%;">Document Type</td>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${documentType}</td>
           </tr>
           <tr>
             <td style="padding:10px 0;color:#94A3B8;font-size:13px;">Received At</td>
             <td style="padding:10px 0;color:#0F172A;font-size:13px;">${uploadedAt}</td>
           </tr>
         </table>`,
      ctaLabel: "Review Document",
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
  const { toEmail, clientName, uploadedAt, agentName } = args;
  await send({
    to: toEmail,
    subject: "Your ID upload was received",
    html: emailTemplate({
      heading: "Document received securely",
      body:
        p(`Hi ${clientName},`) +
        p(`Your ID upload was successfully received by <strong>${agentName}</strong> at <strong>${uploadedAt}</strong>.`) +
        p("No further action is required unless your agent contacts you."),
      notice: `If you need help, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a>.`,
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
    subject: `Data export completed for ${clientLabel}`,
    html: emailTemplate({
      heading: "Submission data exported",
      body:
        p(`Hi ${agentName},`) +
        p(`A data export was completed for <strong>${clientLabel}</strong>.`) +
        `<table style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
           <tr>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;width:40%;">Export Type</td>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${exportFormat.toUpperCase()}</td>
           </tr>
           <tr>
             <td style="padding:10px 0;color:#94A3B8;font-size:13px;">Exported At</td>
             <td style="padding:10px 0;color:#0F172A;font-size:13px;">${exportedAt}</td>
           </tr>
         </table>` +
        p("This is an automatic security notice confirming the export was performed under your account."),
      ctaLabel: "View Details",
      ctaUrl: viewUrl,
      fromSecurity: true,
    }),
  });
}

// ── 18. Transfer Sent → Recipient ────────────────────────────────────────────

export async function sendTransferEmail({
  toEmail,
  agentName,
  title,
  message,
  fileCount,
  totalSizeBytes,
  transferUrl,
  expiresAt,
  viewOnce,
}: {
  toEmail: string;
  agentName: string;
  title: string | null;
  message: string | null;
  fileCount: number;
  totalSizeBytes: number;
  transferUrl: string;
  expiresAt: Date;
  viewOnce: boolean;
}) {
  const resend = getClient();
  if (!resend) return;

  function fmtBytes(n: number): string {
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  const expiry = expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const sizeStr = fmtBytes(totalSizeBytes);

  const body = [
    p(`<strong>${agentName}</strong> sent you ${fileCount} file${fileCount !== 1 ? "s" : ""} (${sizeStr}) via SecureLink.`),
    message ? p(`"${message}"`) : "",
    viewOnce ? p(`<strong>Note:</strong> This link can only be opened once.`) : "",
    p(`The files are available until <strong>${expiry}</strong>.`),
  ].join("");

  const html = emailTemplate({
    heading: title ? `📁 ${title}` : `${agentName} shared ${fileCount} file${fileCount !== 1 ? "s" : ""} with you`,
    body,
    ctaLabel: "Download Files",
    ctaUrl: transferUrl,
    notice: `This transfer expires on ${expiry}. Download before then.`,
  });

  try {
    await resend.emails.send({
      from: FROM_NOTIFICATIONS,
      to: toEmail,
      subject: title
        ? `${agentName} shared "${title}" with you`
        : `${agentName} sent you ${fileCount} file${fileCount !== 1 ? "s" : ""}`,
      html,
    });
  } catch (err) {
    console.error("[email] Failed to send transfer email:", err);
  }
}

export async function sendTransferDownloadNotification({
  agentEmail,
  agentName,
  title,
  fileName,
}: {
  agentEmail: string;
  agentName: string;
  title: string | null;
  fileName: string;
}) {
  const resend = getClient();
  if (!resend) return;

  const html = emailTemplate({
    heading: "Your transfer was downloaded",
    body: [
      p(`Someone just downloaded <strong>${fileName}</strong> from your transfer${title ? ` "<strong>${title}</strong>"` : ""}.`),
    ].join(""),
  });

  try {
    await resend.emails.send({
      from: FROM_NOTIFICATIONS,
      to: agentEmail,
      subject: `Transfer downloaded — ${fileName}`,
      html,
    });
  } catch (err) {
    console.error("[email] Failed to send transfer download notification:", err);
  }
}

// ── DocSign: Request Sent → Client ────────────────────────────────────────────

export async function sendDocSignRequestEmail(args: {
  toEmail: string;
  agentName: string;
  title: string | null;
  message: string | null;
  signUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const { toEmail, agentName, title, message, signUrl, expiresAt } = args;
  const expiry = expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  await send({
    to: toEmail,
    subject: title ? `${agentName} sent you a document to sign: "${title}"` : `${agentName} sent you a document to sign`,
    html: emailTemplate({
      heading: title ? `Please sign: ${title}` : "You have a document to sign",
      body:
        p(`<strong>${agentName}</strong> has sent you a document that requires your signature.`) +
        (message ? p(`"${message}"`) : "") +
        p(`This signing link expires on <strong>${expiry}</strong>.`),
      ctaLabel: "Review & Sign Document",
      ctaUrl: signUrl,
      notice: "Secure Link will never ask for your password or financial details via email. Only use the secure signing link above.",
    }),
  });
}

// ── DocSign: Completed → Agent ────────────────────────────────────────────────

export async function sendDocSignCompletedEmail(args: {
  agentEmail: string;
  agentName: string;
  clientName: string | null;
  title: string | null;
  completedAt: string;
  viewUrl: string;
}): Promise<void> {
  const { agentEmail, agentName, clientName, title, completedAt, viewUrl } = args;
  const clientLabel = clientName ?? "Your client";
  await send({
    to: agentEmail,
    from: FROM_NOTIFICATIONS,
    subject: `Document signed by ${clientLabel}`,
    html: emailTemplate({
      heading: "Document signed",
      body:
        p(`Hi ${agentName},`) +
        p(`<strong>${clientLabel}</strong> has signed ${title ? `"<strong>${title}</strong>"` : "your document"} at <strong>${completedAt}</strong>.`) +
        p("The signed document is available in your dashboard."),
      ctaLabel: "View Signed Document",
      ctaUrl: viewUrl,
    }),
  });
}

// ── Feedback Notification → Support ──────────────────────────────────────────

export async function sendFeedbackNotification(args: {
  agentEmail: string;
  agentName: string;
  category: string;
  message: string;
}): Promise<void> {
  const { agentEmail, agentName, category, message } = args;
  const labels: Record<string, string> = { BUG: "Bug Report", FEATURE: "Feature Request", UX: "UI/UX Feedback", OTHER: "General Feedback" };
  await send({
    to: SUPPORT_EMAIL,
    subject: `[${labels[category] ?? category}] Feedback from ${agentName}`,
    html: emailTemplate({
      heading: `${labels[category] ?? category}`,
      body:
        p(`<strong>From:</strong> ${agentName} (${agentEmail})`) +
        p(`<strong>Category:</strong> ${labels[category] ?? category}`) +
        `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 20px;margin:16px 0;font-size:15px;color:#334155;line-height:1.7;">${message}</div>`,
    }),
  });
}

// ── 19. Plan Upgrade Confirmation → User ─────────────────────────────────────

const PLAN_FEATURES: Record<string, string[]> = {
  BEGINNER: ["50 secure links/month", "Email support", "Basic analytics"],
  PRO: ["Unlimited secure links", "File transfers", "Custom forms", "Priority support"],
  AGENCY: ["Everything in Pro", "Up to 5 team members", "Branded links"],
};

export async function sendPlanUpgradeEmail(args: {
  toEmail: string;
  toName: string;
  plan: string;
}): Promise<void> {
  const { toEmail, toName, plan } = args;
  const planLabel = plan.charAt(0) + plan.slice(1).toLowerCase();
  const features = PLAN_FEATURES[plan] ?? [];
  const featureList = features.length
    ? `<ul style="padding-left:20px;color:#475569;font-size:15px;line-height:1.8;margin:0 0 14px;">
        ${features.map((f) => `<li>${f}</li>`).join("")}
       </ul>`
    : "";
  await send({
    to: toEmail,
    subject: `You're now on the ${planLabel} plan`,
    html: emailTemplate({
      heading: `Welcome to ${planLabel}.`,
      body:
        p(`Hi ${toName},`) +
        p(`Your upgrade to the <strong>${planLabel} plan</strong> was successful. Here's what's now unlocked on your account:`) +
        featureList +
        p("Head to your dashboard to start using your new features."),
      ctaLabel: "Go to Dashboard",
      ctaUrl: `${APP_URL}/dashboard`,
    }),
  });
}

// ── 20. Subscription Cancelled → User ────────────────────────────────────────

export async function sendSubscriptionCancelledEmail(args: {
  toEmail: string;
  toName: string;
  previousPlan: string;
}): Promise<void> {
  const { toEmail, toName, previousPlan } = args;
  const planLabel = previousPlan.charAt(0) + previousPlan.slice(1).toLowerCase();
  await send({
    to: toEmail,
    subject: "Your Secure Link subscription was cancelled",
    html: emailTemplate({
      heading: "Subscription cancelled",
      body:
        p(`Hi ${toName},`) +
        p(`Your <strong>${planLabel}</strong> subscription has been cancelled and your account has been moved back to the <strong>Free plan</strong>.`) +
        p("You'll still have access to your existing data and can continue using Secure Link with up to 10 lifetime secure links.") +
        p("If this was a mistake or you'd like to resubscribe, you can do so at any time from your dashboard."),
      ctaLabel: "Resubscribe",
      ctaUrl: `${APP_URL}/pricing`,
      notice: `If you didn't cancel this subscription, contact us immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a>.`,
      fromSecurity: true,
    }),
  });
}

// ── 21. Payment Failed → User ─────────────────────────────────────────────────

export async function sendPaymentFailedEmail(args: {
  toEmail: string;
  toName: string;
  portalUrl?: string;
}): Promise<void> {
  const { toEmail, toName, portalUrl } = args;
  const billingUrl = portalUrl ?? `${APP_URL}/dashboard/settings#billing`;
  await send({
    to: toEmail,
    from: FROM_SECURITY,
    subject: "Payment failed — action required",
    html: emailTemplate({
      heading: "We couldn't process your payment",
      body:
        p(`Hi ${toName},`) +
        p("We were unable to process your last payment. As a result, your account has been downgraded to the <strong>Free plan</strong>.") +
        p("To restore your access, please update your payment method in your billing settings."),
      ctaLabel: "Update Payment Method",
      ctaUrl: billingUrl,
      notice: "Until your payment is resolved, you'll be limited to the Free plan features. Your existing data and links remain safe.",
      fromSecurity: true,
    }),
  });
}

// ── 22. New Signup Notification → Admin ───────────────────────────────────────

const ADMIN_EMAIL = "malek@mysecurelink.co";

export async function sendNewSignupNotification(args: {
  newUserEmail: string;
  newUserName: string;
  signedUpAt: string;
}): Promise<void> {
  const { newUserEmail, newUserName, signedUpAt } = args;
  await send({
    to: ADMIN_EMAIL,
    subject: `New signup — ${newUserName}`,
    html: emailTemplate({
      heading: "New user signed up",
      body:
        `<table style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
           <tr>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;width:40%;">Name</td>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${newUserName}</td>
           </tr>
           <tr>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#94A3B8;font-size:13px;">Email</td>
             <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${newUserEmail}</td>
           </tr>
           <tr>
             <td style="padding:10px 0;color:#94A3B8;font-size:13px;">Signed Up</td>
             <td style="padding:10px 0;color:#0F172A;font-size:13px;">${signedUpAt}</td>
           </tr>
         </table>`,
      ctaLabel: "View in Mission Control",
      ctaUrl: `${APP_URL}/adminn/users`,
    }),
  });
}

// ── 23. Account Banned → User ─────────────────────────────────────────────────

export async function sendAccountBannedEmail(args: {
  toEmail: string;
  toName: string;
}): Promise<void> {
  const { toEmail, toName } = args;
  await send({
    to: toEmail,
    from: FROM_SECURITY,
    subject: "Your Secure Link account has been suspended",
    html: emailTemplate({
      heading: "Account suspended",
      body:
        p(`Hi ${toName},`) +
        p("Your Secure Link account has been suspended and you will no longer be able to sign in.") +
        p("If you believe this was a mistake, please contact our support team and we'll review your account."),
      ctaLabel: "Contact Support",
      ctaUrl: `mailto:${SUPPORT_EMAIL}`,
      notice: `To appeal this decision, email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0057FF;">${SUPPORT_EMAIL}</a> with your account email and we'll respond within 1 business day.`,
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
    subject: `Sensitive data was revealed for ${clientLabel}`,
    html: emailTemplate({
      heading: "Encrypted data revealed",
      body:
        p(`Hi ${agentName},`) +
        p(`Sensitive data for <strong>${clientLabel}</strong> was revealed at <strong>${revealedAt}</strong>.`) +
        p("This is an automatic security notice logged to your audit trail."),
      ctaLabel: "View Audit Details",
      ctaUrl: viewUrl,
      fromSecurity: true,
    }),
  });
}
