import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { sendSms, isTwilioConfigured } from "@/lib/sms";
import { LINK_TYPES } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({
  to: z
    .string()
    .min(7, "Phone number required")
    .max(30)
    .regex(/^\+?[\d\s\-().]+$/, "Invalid phone number"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: "SMS is not configured on this server." },
      { status: 503 }
    );
  }

  const link = await db.secureLink.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });

  if (!link) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.to?.[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const baseUrl = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}/secure/${link.token}`;
  const clientFirst = link.clientName?.split(" ")[0] ?? "";
  const typeLabel =
    LINK_TYPES[link.linkType as keyof typeof LINK_TYPES] ?? "information";

  const message =
    `${clientFirst ? `Hi ${clientFirst}, ` : ""}I need to securely collect your ${typeLabel.toLowerCase()} ` +
    `for your application. Please tap this private encrypted link and enter it directly:\n\n${url}\n\nLet me know once you've submitted it.`;

  const result = await sendSms(parsed.data.to, message);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
