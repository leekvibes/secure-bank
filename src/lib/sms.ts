/**
 * SMS via Twilio. Gracefully no-ops if Twilio env vars are not set.
 * Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;

  // Lazy import to avoid loading Twilio in environments where it's not needed
  const twilio = require("twilio");
  return twilio(sid, token);
}

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient();
  if (!client) {
    return { success: false, error: "SMS not configured on this server." };
  }

  const from = process.env.TWILIO_FROM_NUMBER;
  try {
    await client.messages.create({ to, from, body });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "SMS send failed.";
    console.error("[sms] Twilio error:", msg);
    return { success: false, error: msg };
  }
}
