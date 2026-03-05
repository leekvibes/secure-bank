import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { createFormLinkSchema } from "@/lib/schemas";
import { generateToken } from "@/lib/tokens";
import { addHours } from "date-fns";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id, status: "ACTIVE" },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createFormLinkSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Invalid input" }, { status: 400 });
  }

  const { clientName, clientPhone, clientEmail, expirationHours } = parsed.data;

  const token = generateToken();
  const expiresAt = addHours(new Date(), expirationHours);

  const link = await db.formLink.create({
    data: {
      formId: form.id,
      token,
      clientName: clientName || null,
      clientPhone: clientPhone || null,
      clientEmail: clientEmail || null,
      expiresAt,
    },
  });

  const baseUrl = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}/f/${token}`;

  const clientPart = clientName ? `Hi ${clientName.split(" ")[0]}, ` : "";
  const smsText = `${clientPart}Please fill out this secure form for ${form.title}. Your information is encrypted and goes directly to your agent:\n\n${url}\n\nLet me know once you've submitted it.`;

  return NextResponse.json({ id: link.id, token, url, smsText, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
