import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkDocSignLimit, getPlan } from "@/lib/plans";
import { addHours } from "date-fns";

// POST /api/signing/requests — create a new DRAFT signing request
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim() || null;
    const message = String(body.message ?? "").trim() || null;
    const expiresInHours = Number(body.expiresInHours) || 72;

    // Plan gating check (counts sent requests, not drafts)
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    const plan = user?.plan ?? "FREE";
    const { allowed, used, limit } = await checkDocSignLimit(db, session.user.id, plan);

    if (!allowed) {
      const planConfig = getPlan(plan);
      return apiError(
        403,
        "SIGNING_LIMIT_REACHED",
        `You've used ${used}/${limit} document signatures this month on the ${planConfig.name} plan. Upgrade to send more.`
      );
    }

    const request = await db.docSignRequest.create({
      data: {
        token: generateToken(),
        title,
        message,
        status: "DRAFT",
        expiresAt: addHours(new Date(), expiresInHours),
        agentId: session.user.id,
      },
      select: { id: true, token: true },
    });

    return apiSuccess({ id: request.id, token: request.token }, 201);
  } catch (err) {
    console.error("[signing/requests/create]", err);
    return apiError(500, "SERVER_ERROR", "Failed to create signing request.");
  }
}

// GET /api/signing/requests — list all signing requests for this agent
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const requests = await db.docSignRequest.findMany({
      where: {
        agentId: session.user.id,
        // Only return requests from the new signing flow (have blobUrl or are DRAFT with no originalFilePath)
        OR: [
          { blobUrl: { not: null } },
          { status: "DRAFT", originalFilePath: "" },
        ],
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        token: true,
        title: true,
        status: true,
        signingMode: true,
        originalName: true,
        expiresAt: true,
        completedAt: true,
        voidedAt: true,
        createdAt: true,
        recipients: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            order: true,
            completedAt: true,
          },
          orderBy: { order: "asc" },
        },
        _count: { select: { signingFields: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess({ requests });
  } catch (err) {
    console.error("[signing/requests/list]", err);
    return apiError(500, "SERVER_ERROR", "Failed to load signing requests.");
  }
}
