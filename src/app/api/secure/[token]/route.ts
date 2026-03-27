import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  bankingInfoSchema,
  ssnOnlySchema,
  fullIntakeSchema,
} from "@/lib/schemas";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionNotification, sendSubmissionConfirmationToClient } from "@/lib/email";
import { apiError, apiSuccess } from "@/lib/api-response";
import { buildEncryptedSubmissionData } from "@/lib/submission-storage";
import { isValidSingleUseToken } from "@/lib/validation";
import {
  ensureLegacyLogoAsset,
  selectAssetsForToken,
  toAssetRenderEntry,
} from "@/lib/asset-library";
import { addDays } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const viewLimit = await checkRateLimit(`secure:view:${params.token}:${ip}`);
  if (!viewLimit.allowed) {
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please wait 15 minutes."
    );
  }

  const link = await db.secureLink.findUnique({
    where: { token: params.token },
    include: {
      assets: {
        orderBy: { order: "asc" },
        include: { asset: true },
      },
      agent: {
        select: {
          displayName: true,
          agencyName: true,
          destinationLabel: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!link) {
    return apiError(404, "LINK_NOT_FOUND", "Link not found.");
  }

  await ensureLegacyLogoAsset(link.agentId);

  const [existingSubmission, existingUpload] = await Promise.all([
    db.submission.findUnique({ where: { linkId: link.id }, select: { id: true } }),
    db.idUpload.findUnique({ where: { linkId: link.id }, select: { id: true } }),
  ]);
  const tokenState = isValidSingleUseToken(
    link.expiresAt,
    link.status,
    Boolean(existingSubmission || existingUpload)
  );
  if (!tokenState.ok) {
    return apiError(
      tokenState.code === "expired" ? 410 : 409,
      tokenState.code === "expired" ? "LINK_EXPIRED" : "LINK_ALREADY_USED",
      tokenState.message
    );
  }

  if (link.status === "CREATED") {
    await db.secureLink.update({ where: { id: link.id }, data: { status: "OPENED" } });
    await writeAuditLog({
      event: link.linkType === "SSN_ONLY" ? "SSN_OPENED" : "LINK_OPENED",
      agentId: link.agentId,
      linkId: link.id,
      request: req,
      metadata: { via: "api" },
    });
  }

  const fallbackAssets = await db.agentAsset.findMany({
    where: { userId: link.agentId, type: "LOGO" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  const selectedAssets = selectAssetsForToken(
    link.assets.map((entry) => entry.asset),
    fallbackAssets
  );

  const assetPayload = (
    await Promise.all(selectedAssets.map((asset) => toAssetRenderEntry(asset)))
  ).filter((asset) => asset.url && asset.mimeType.startsWith("image/"));
  const logoUrls = assetPayload
    .map((asset) => asset.url)
    .filter((url): url is string => Boolean(url));
  if (logoUrls.length === 0 && link.agent.logoUrl) {
    logoUrls.push(link.agent.logoUrl);
  }

  return apiSuccess(
    {
      link: {
        token: params.token,
        linkType: link.linkType,
        destinationLabel: link.destinationLabel ?? link.destination,
        messageTemplate: link.messageTemplate,
        options: link.optionsJson ? JSON.parse(link.optionsJson) : {},
        clientName: link.clientName,
        expiresAt: link.expiresAt.toISOString(),
      },
      agent: {
        ...link.agent,
        logoUrl: logoUrls[0] ?? link.agent.logoUrl,
      },
      assets: assetPayload,
      logoUrls,
    },
    200
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit by token (prevents repeated submissions / enumeration)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitKey = `submit:${params.token}:${ip}`;
  const { allowed } = await checkRateLimit(rateLimitKey);

  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes.");
  }

  // Fetch link + agent email for notification
  const link = await db.secureLink.findUnique({
    where: { token: params.token },
    include: { agent: { select: { email: true, displayName: true } } },
  });

  if (!link) {
    return apiError(404, "LINK_NOT_FOUND", "Link not found.");
  }

  if (link.linkType === "ID_UPLOAD") {
    return apiError(400, "INVALID_LINK_TYPE", "This link accepts ID uploads only.");
  }

  // Prevent double submission
  const existing = await db.submission.findUnique({
    where: { linkId: link.id },
  });
  const tokenState = isValidSingleUseToken(link.expiresAt, link.status, Boolean(existing));
  if (!tokenState.ok) {
    return apiError(
      tokenState.code === "expired" ? 410 : 409,
      tokenState.code === "expired" ? "LINK_EXPIRED" : "LINK_ALREADY_USED",
      tokenState.message
    );
  }

  // Parse + validate
  let body: Record<string, string | boolean>;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Invalid request body.");
  }

  let validated: Record<string, string | boolean>;
  const schema =
    link.linkType === "BANKING_INFO"
      ? bankingInfoSchema
      : link.linkType === "SSN_ONLY"
      ? ssnOnlySchema
      : fullIntakeSchema;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(flat.fieldErrors)) {
      fieldErrors[k] = (v as string[])[0];
    }
    return apiError(
      422,
      "VALIDATION_ERROR",
      "Please fix the errors below.",
      { fieldErrors }
    );
  }

  validated = parsed.data as unknown as Record<string, string | boolean>;

  const linkOptions =
    link.optionsJson && link.optionsJson.trim().length > 0
      ? (() => {
          try {
            return JSON.parse(link.optionsJson) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : {};
  const middleInitialEnabled =
    Boolean(linkOptions.middleInitialEnabled) ||
    Boolean(linkOptions.requireMiddleInitial);
  if (
    link.linkType === "BANKING_INFO" &&
    middleInitialEnabled &&
    typeof validated.middleInitial !== "string"
  ) {
    return apiError(422, "VALIDATION_ERROR", "Please fix the errors below.", {
      fieldErrors: { middleInitial: "Middle initial is required." },
    });
  }

  const encryptedData = buildEncryptedSubmissionData(validated);
  const deleteAt =
    link.retentionDays > 0
      ? addDays(new Date(), link.retentionDays)
      : new Date("9999-12-31T23:59:59.999Z");

  // Store submission + update link status atomically
  await db.$transaction([
    db.submission.create({
      data: {
        linkId: link.id,
        encryptedData,
        deleteAt,
      },
    }),
    db.secureLink.update({
      where: { id: link.id },
      data: { status: "SUBMITTED" },
    }),
  ]);

  await writeAuditLog({
    event: link.linkType === "SSN_ONLY" ? "SSN_SUBMITTED" : "SUBMITTED",
    agentId: link.agentId,
    linkId: link.id,
    request: req,
  });

  // Fire-and-forget notification — never blocks the response
  const newSubmission = await db.submission.findUnique({
    where: { linkId: link.id },
    select: { id: true },
  });
  if (newSubmission) {
    const typeLabels: Record<string, string> = {
      BANKING_INFO: "Banking Information",
      SSN_ONLY: "SSN (Secure)",
      FULL_INTAKE: "Full Intake",
      ID_UPLOAD: "ID Document Upload",
    };
    const submittedAt = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

    // Notify agent
    sendSubmissionNotification({
      agentEmail: link.agent.email,
      agentName: link.agent.displayName,
      clientName: link.clientName,
      linkType: link.linkType,
      submissionId: newSubmission.id,
    });

    // Confirm receipt to client if email is known
    if (link.clientEmail) {
      sendSubmissionConfirmationToClient({
        toEmail: link.clientEmail,
        clientName: link.clientName ?? "there",
        requestType: typeLabels[link.linkType] ?? link.linkType,
        submittedAt,
        agentName: link.agent.displayName,
      });
    }
  }

  return apiSuccess({ success: true }, 201);
}
