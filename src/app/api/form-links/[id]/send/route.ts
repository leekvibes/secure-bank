import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendSms, isTwilioConfigured } from "@/lib/sms";
import { sendSecureLinkEmail } from "@/lib/email";
import { isValidEmailAddress, isValidPhoneNumber } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { NO_STORE_HEADERS } from "@/lib/http";

const sendSchema = z.object({
  method: z.enum(["SMS", "EMAIL", "COPY", "SHARE"]),
  recipient: z.string().min(1).max(200),
  message: z.string().min(10).max(4000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json(
      { error: first ?? "Invalid request." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const formLink = await db.formLink.findFirst({
    where: { id: params.id, form: { agentId: session.user.id } },
    include: { form: { select: { title: true, agentId: true, agent: { select: { displayName: true } } } } },
  });
  if (!formLink) {
    return NextResponse.json(
      { error: "Link not found." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const { method, recipient, message } = parsed.data;

  if (method === "SMS") {
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: "SMS is not configured on this server." },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }
    if (!isValidPhoneNumber(recipient)) {
      return NextResponse.json(
        { error: "Invalid phone number." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const result = await sendSms(recipient, message);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send SMS." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  if (method === "EMAIL") {
    if (!isValidEmailAddress(recipient)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const result = await sendSecureLinkEmail({
      toEmail: recipient,
      agentName: formLink.form.agent.displayName,
      message,
    });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send email." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  await db.formLinkDispatch.create({
    data: {
      formLinkId: formLink.id,
      method,
      recipient,
      message,
    },
  });

  await writeAuditLog({
    event: "LINK_SENT",
    agentId: formLink.form.agentId,
    request: req,
    metadata: { method, recipient, formLinkId: formLink.id, formTitle: formLink.form.title },
  });

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
