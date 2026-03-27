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
import { applyTemplateDefaults } from "@/lib/link-templates";
import { getPlan, getMonthlyLinkCount, getTotalLinkCount } from "@/lib/plans";

function isPrismaSchemaDriftError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : "";
  return (
    message.includes("Unknown field") ||
    message.includes("does not exist in the current database") ||
    message.includes("The column") ||
    message.includes("no such column")
  );
}

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

    const agent = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        defaultExpirationHours: true,
        trustMessage: true,
        destinationLabel: true,
        dataRetentionDays: true,
        plan: true,
      },
    });

    // Plan gating — check link limit
    const planConfig = getPlan(agent?.plan ?? "FREE");
    if (planConfig.linkLimit !== null) {
      const used = planConfig.lifetimeLimit
        ? await getTotalLinkCount(db, session.user.id)
        : await getMonthlyLinkCount(db, session.user.id);
      if (used >= planConfig.linkLimit) {
        const limitLabel = planConfig.lifetimeLimit
          ? `${planConfig.linkLimit} links total`
          : `${planConfig.linkLimit} links/month`;
        return NextResponse.json(
          {
            error: `You've used all ${limitLabel} on the ${planConfig.name} plan. Upgrade to send more.`,
            code: "UPGRADE_REQUIRED",
          },
          { status: 403 }
        );
      }
    }

    let payload = parsed.data;

    const rawExpiration = body?.expirationHours;
    if (rawExpiration === undefined || rawExpiration === null) {
      payload.expirationHours = agent?.defaultExpirationHours ?? 24;
    }
    if (!payload.destinationLabel && !payload.destination && agent?.destinationLabel) {
      payload.destinationLabel = agent.destinationLabel;
    }

    if (payload.templateId) {
      const template = await db.linkTemplate.findFirst({
        where: { id: payload.templateId, userId: session.user.id },
        include: { assets: { orderBy: { order: "asc" }, select: { assetId: true, order: true } } },
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found." }, { status: 404 });
      }
      payload = applyTemplateDefaults(template, {
        ...payload,
        assetIds: Array.isArray(body?.assetIds) ? payload.assetIds : undefined,
      });
    }

    const {
      linkType,
      destination,
      destinationLabel,
      message,
      options,
      clientName,
      clientPhone,
      clientEmail,
      expirationHours,
      retentionDays,
      assetIds,
    } = payload;
    if (!linkType) {
      return NextResponse.json({ error: "Link type is required." }, { status: 400 });
    }

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
    const effectiveRetentionDays =
      retentionDays === undefined ? (agent?.dataRetentionDays ?? 30) : retentionDays;

    const normalizedDestination =
      destinationLabel?.trim() || destination?.trim() || "Internal processing";

    let link: { id: string; destination: string | null };
    try {
      link = await db.secureLink.create({
        data: {
          token,
          linkType,
          destination: normalizedDestination,
          destinationLabel: normalizedDestination,
          messageTemplate: message?.trim() || null,
          optionsJson: options ? JSON.stringify(options) : null,
          clientName: clientName || null,
          clientPhone: clientPhone || null,
          clientEmail: clientEmail || null,
          expiresAt,
          retentionDays: effectiveRetentionDays,
          agentId: session.user.id,
          assets:
            uniqueAssetIds.length > 0
              ? {
                  create: uniqueAssetIds.map((assetId, order) => ({
                    assetId,
                    order,
                  })),
                }
              : undefined,
        },
        select: { id: true, destination: true },
      });
    } catch (createErr) {
      if (!isPrismaSchemaDriftError(createErr)) throw createErr;
      link = await db.secureLink.create({
        data: {
          token,
          linkType,
          destination: normalizedDestination,
          clientName: clientName || null,
          clientPhone: clientPhone || null,
          clientEmail: clientEmail || null,
          expiresAt,
          retentionDays: effectiveRetentionDays,
          agentId: session.user.id,
        },
        select: { id: true, destination: true },
      });
    }

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

    const messageText = `${clientPart}I need to securely collect your ${typePart} for your application. Instead of reading it aloud, please tap this private link and enter it directly — it's encrypted and expires soon:\n\n${url}\n\nLet me know once you've submitted it.`;
    const trustMessage = buildTrustMessage({
      clientName: clientName || null,
      destination:
        destinationLabel?.trim() || destination?.trim() || "Internal processing",
      linkType,
      url,
    });

    return NextResponse.json(
      {
        id: link.id,
        token,
        url,
        messageText,
        trustMessage,
        destination: link.destination,
        destinationLabel: normalizedDestination,
        message: message?.trim() || "",
        options: options ?? {},
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
    let links: any[] = [];
    try {
      links = await db.secureLink.findMany({
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
    } catch (queryErr) {
      if (!isPrismaSchemaDriftError(queryErr)) throw queryErr;
      const fallback = await db.secureLink.findMany({
        where: { agentId: session.user.id },
        include: { submission: { select: { id: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      links = fallback.map((link) => ({ ...link, sends: [], _count: { sends: 0 } }));
    }

    return NextResponse.json({ links });
  } catch (err) {
    console.error("[links/list]", err);
    return NextResponse.json({ error: "Failed to load links." }, { status: 500 });
  }
}
