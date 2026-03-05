import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { createLinkSchema } from "@/lib/schemas";
import { generateToken } from "@/lib/tokens";
import { writeAuditLog } from "@/lib/audit";
import { assertAssetOwnership } from "@/lib/asset-library";
import { addHours } from "date-fns";
import { buildTrustMessage } from "@/lib/link-message";

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
      destination,
      clientName,
      clientPhone,
      clientEmail,
      expirationHours,
      retentionDays,
      assetIds,
    } = parsed.data;

    // Validate asset ownership
    const uniqueAssetIds = Array.from(new Set(assetIds ?? []));
    if (uniqueAssetIds.length > 0) {
      const owned = await db.agentAsset.findMany({
        where: { userId: session.user.id, id: { in: uniqueAssetIds } },
        select: { id: true },
      });
      try {
        assertAssetOwnership(owned.map((a) => a.id), uniqueAssetIds);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid assets." },
          { status: 403 }
        );
      }
    }

    const token = generateToken();
    const effectiveExpirationHours =
      linkType === "SSN_ONLY" && expirationHours === 24 ? 168 : expirationHours;
    const expiresAt = addHours(new Date(), effectiveExpirationHours);

    const link = await db.secureLink.create({
      data: {
        token,
        linkType,
        destination: destination?.trim() || "Internal processing",
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        expiresAt,
        retentionDays,
        agentId: session.user.id,
        assets: uniqueAssetIds.length > 0 ? {
          create: uniqueAssetIds.map((assetId, order) => ({ assetId, order })),
        } : undefined,
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
    const trustMessage = buildTrustMessage({
      clientName: clientName || null,
      destination: destination || "Internal processing",
      linkType,
      url,
    });

    return NextResponse.json(
      {
        id: link.id,
        token,
        url,
        smsText,
        trustMessage,
        destination: link.destination,
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
      include: {
        submission: { select: { id: true } },
        sends: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { method: true, recipient: true, createdAt: true },
        },
        _count: { select: { sends: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ links });
  } catch (err) {
    console.error("[links/list]", err);
    return NextResponse.json({ error: "Failed to load links." }, { status: 500 });
  }
}
