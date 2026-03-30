import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

const schema = z.object({
  eventId: z.string().max(120).optional(),
  page: z.number().int().min(1),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  dwellMs: z.number().int().min(1).max(30 * 60 * 1000),
  maxScrollPct: z.number().min(0).max(100).optional(),
  source: z.string().max(40).optional(),
});

// POST /api/sign/[token]/analytics/page-view
// Stores signer page view analytics for later aggregation on the dashboard.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const recipient = await db.docSignRecipient.findUnique({
    where: { token: params.token },
    include: {
      request: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
          pages: { select: { page: true } },
        },
      },
    },
  });

  if (!recipient) return apiError(404, "NOT_FOUND", "Signing link not found.");
  if (recipient.request.status === "VOIDED") return apiError(410, "VOIDED", "This document has been voided.");
  if (recipient.request.expiresAt < new Date()) return apiError(410, "EXPIRED", "This signing link has expired.");
  if (recipient.status === "DECLINED") return apiError(410, "DECLINED", "Signing session declined.");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return apiError(400, "VALIDATION_ERROR", first ?? "Invalid page analytics payload.");
  }

  const data = parsed.data;
  const pageExists = recipient.request.pages.some((p) => p.page === data.page);
  if (!pageExists) return apiError(400, "INVALID_PAGE", "Page is out of range for this document.");

  if (data.eventId) {
    const duplicate = await db.docSignAuditLog.findFirst({
      where: {
        requestId: recipient.request.id,
        recipientId: recipient.id,
        event: "PAGE_VIEW",
        metadata: { contains: `"eventId":"${data.eventId}"` },
      },
      select: { id: true },
    });
    if (duplicate) return apiSuccess({ accepted: true, duplicate: true });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;

  await db.docSignAuditLog.create({
    data: {
      requestId: recipient.request.id,
      recipientId: recipient.id,
      event: "PAGE_VIEW",
      ipAddress: ip,
      userAgent: ua,
      metadata: JSON.stringify({
        eventId: data.eventId ?? null,
        page: data.page,
        startedAt: data.startedAt ?? null,
        endedAt: data.endedAt ?? null,
        dwellMs: data.dwellMs,
        maxScrollPct: Math.round((data.maxScrollPct ?? 0) * 100) / 100,
        source: data.source ?? "signing-ceremony",
      }),
    },
  });

  return apiSuccess({ accepted: true });
}

