import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { createLinkSchema } from "@/lib/schemas";
import { generateToken } from "@/lib/tokens";
import { writeAuditLog } from "@/lib/audit";
import { addHours } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createLinkSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const first = Object.values(errors).flat()[0];
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const {
      linkType,
      clientName,
      clientPhone,
      clientEmail,
      expirationHours,
      retentionDays,
    } = parsed.data;

    const token = generateToken();
    const effectiveExpirationHours =
      linkType === "SSN_ONLY" && expirationHours === 24 ? 168 : expirationHours;
    const expiresAt = addHours(new Date(), effectiveExpirationHours);

    const link = await db.secureLink.create({
      data: {
        token,
        linkType,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        expiresAt,
        retentionDays,
        agentId: session.user.id,
      },
    });

    await writeAuditLog({
      event: "LINK_CREATED",
      agentId: session.user.id,
      linkId: link.id,
      request: req,
      metadata: { linkType },
    });

    const baseUrl = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
    const url = `${baseUrl}/secure/${token}`;

    // Pre-written SMS text
    const clientPart = clientName ? `Hi ${clientName.split(" ")[0]}, ` : "";
    const typePart =
      linkType === "BANKING_INFO"
        ? "banking information"
        : linkType === "SSN_ONLY"
        ? "your Social Security Number"
        : linkType === "ID_UPLOAD"
        ? "a photo of your ID"
        : "your information";

    const smsText = `${clientPart}I need to securely collect your ${typePart} for your application. Instead of reading it aloud, please tap this private link and enter it directly — it's encrypted and expires soon:\n\n${url}\n\nLet me know once you've submitted it.`;

    return NextResponse.json(
      {
        id: link.id,
        token,
        url,
        smsText,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[links/create]", err);
    return NextResponse.json(
      { error: "Failed to create link." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const links = await db.secureLink.findMany({
      where: { agentId: session.user.id },
      include: { submission: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ links });
  } catch (err) {
    console.error("[links/list]", err);
    return NextResponse.json({ error: "Failed to load links." }, { status: 500 });
  }
}
