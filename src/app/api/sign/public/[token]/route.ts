import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateToken } from "@/lib/tokens";

async function loadLink(token: string) {
  return db.docSignPublicLink.findUnique({
    where: { token },
    include: {
      request: {
        include: {
          agent: { select: { displayName: true, agencyName: true, company: true, logoUrl: true, photoUrl: true } },
          pages: { orderBy: { page: "asc" } },
        },
      },
      usages: { select: { id: true } },
    },
  });
}

function validateLink(link: Awaited<ReturnType<typeof loadLink>>) {
  if (!link) return "NOT_FOUND";
  if (!link.isActive) return "DEACTIVATED";
  if (link.expiresAt && link.expiresAt < new Date()) return "LINK_EXPIRED";
  if (link.maxUses != null && link.usedCount >= link.maxUses) return "MAX_USES";
  if (link.request.status === "VOIDED") return "REQUEST_VOIDED";
  if (link.request.status === "COMPLETED") return "REQUEST_COMPLETED";
  if (link.request.expiresAt < new Date()) return "REQUEST_EXPIRED";
  return null;
}

// GET /api/sign/public/[token] — landing page data
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const link = await loadLink(params.token);
  const validationError = validateLink(link);

  if (validationError === "NOT_FOUND") return apiError(404, "NOT_FOUND", "Link not found.");

  if (validationError) {
    const messages: Record<string, string> = {
      DEACTIVATED: "This signing link has been deactivated.",
      LINK_EXPIRED: "This signing link has expired.",
      MAX_USES: "This link has reached its maximum number of uses.",
      REQUEST_VOIDED: "This document has been voided.",
      REQUEST_COMPLETED: "This document has already been completed.",
      REQUEST_EXPIRED: "This signing request has expired.",
    };
    return apiSuccess({
      expired: true,
      reason: validationError,
      message: messages[validationError] ?? "This link is no longer available.",
      agentName: link!.request.agent.displayName,
      agencyName: link!.request.agent.agencyName ?? link!.request.agent.company ?? null,
    });
  }

  return apiSuccess({
    expired: false,
    label: link!.label,
    documentTitle: link!.request.title?.trim() || link!.request.originalName || "Document",
    requireName: link!.requireName,
    requireEmail: link!.requireEmail,
    usedCount: link!.usedCount,
    maxUses: link!.maxUses,
    agent: {
      displayName: link!.request.agent.displayName,
      agencyName: link!.request.agent.agencyName ?? link!.request.agent.company ?? null,
      logoUrl: link!.request.agent.logoUrl,
    },
  });
}

// POST /api/sign/public/[token] — submit name/email, create recipient + clone fields
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const link = await loadLink(params.token);
  const validationError = validateLink(link);

  if (validationError === "NOT_FOUND") return apiError(404, "NOT_FOUND", "Link not found.");
  if (validationError) return apiError(410, validationError, "This link is no longer available.");

  let body: { name?: string; email?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const name = body.name?.trim() || "Guest";
  const email = body.email?.trim() || "";

  if (link!.requireName && !body.name?.trim()) {
    return apiError(400, "NAME_REQUIRED", "Your name is required.");
  }
  if (link!.requireEmail && !email) {
    return apiError(400, "EMAIL_REQUIRED", "Your email address is required.");
  }

  // Get the slot recipient's fields to clone
  const slotFields = await db.docSignField.findMany({
    where: { recipientId: link!.slotRecipientId },
  });

  if (slotFields.length === 0) {
    return apiError(400, "NO_FIELDS", "This document has no signing fields configured.");
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const recipientToken = generateToken();

  // Transaction: create recipient, clone fields, create usage, increment count
  const newRecipient = await db.$transaction(async (tx) => {
    // Re-check maxUses inside transaction to prevent race conditions
    const fresh = await tx.docSignPublicLink.findUnique({
      where: { id: link!.id },
      select: { usedCount: true, maxUses: true, isActive: true },
    });
    if (!fresh || !fresh.isActive) throw new Error("DEACTIVATED");
    if (fresh.maxUses != null && fresh.usedCount >= fresh.maxUses) throw new Error("MAX_USES");

    const recipient = await tx.docSignRecipient.create({
      data: {
        requestId: link!.requestId,
        name,
        email,
        order: 0,
        token: recipientToken,
        status: "PENDING",
        isPublicSlot: false,
      },
    });

    // Clone fields from slot
    await tx.docSignField.createMany({
      data: slotFields.map((f) => ({
        requestId: f.requestId,
        recipientId: recipient.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required,
        options: f.options,
      })),
    });

    await tx.docSignPublicUsage.create({
      data: { linkId: link!.id, recipientId: recipient.id, ipAddress: ip },
    });

    await tx.docSignPublicLink.update({
      where: { id: link!.id },
      data: { usedCount: { increment: 1 } },
    });

    await tx.docSignAuditLog.create({
      data: {
        requestId: link!.requestId,
        event: "PUBLIC_LINK_USED",
        ipAddress: ip,
        metadata: JSON.stringify({ linkId: link!.id, signerName: name, signerEmail: email }),
      },
    });

    return recipient;
  });

  return apiSuccess({ token: newRecipient.token });
}
