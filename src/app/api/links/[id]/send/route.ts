import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendSms, isTwilioConfigured } from "@/lib/sms";
import { sendSecureLinkEmail } from "@/lib/email";
import { isValidEmailAddress, isValidPhoneNumber } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

const sendSchema = z.object({
  method: z.enum(["SMS", "EMAIL", "COPY"]),
  recipient: z.string().min(1).max(200),
  message: z.string().min(10).max(4000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Invalid request." }, { status: 400 });
  }

  const link = await db.secureLink.findFirst({
    where: { id: params.id, agentId: session.user.id },
    select: { id: true, token: true, linkType: true, destination: true, agent: { select: { displayName: true } } },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const { method, recipient, message } = parsed.data;

  if (method === "SMS") {
    if (!isTwilioConfigured()) {
      return NextResponse.json({ error: "SMS is not configured on this server." }, { status: 503 });
    }
    if (!isValidPhoneNumber(recipient)) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }
    const result = await sendSms(recipient, message);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to send SMS." }, { status: 500 });
    }
  }

  if (method === "EMAIL") {
    if (!isValidEmailAddress(recipient)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    const result = await sendSecureLinkEmail({
      toEmail: recipient,
      agentName: link.agent.displayName,
      message,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to send email." }, { status: 500 });
    }
  }

  await db.linkDispatch.create({
    data: {
      linkId: link.id,
      method,
      recipient,
      message,
    },
  });

  await writeAuditLog({
    event: "LINK_SENT",
    agentId: session.user.id,
    linkId: link.id,
    request: req,
    metadata: { method, recipient },
  });

  return NextResponse.json({ success: true });
}
