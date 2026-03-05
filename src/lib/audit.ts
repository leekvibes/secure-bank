import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export type AuditEvent =
  | "LINK_CREATED"
  | "LINK_OPENED"
  | "SUBMITTED"
  | "REVEALED"
  | "SSN_OPENED"
  | "SSN_SUBMITTED"
  | "SSN_REVEALED"
  | "ID_UPLOADED"
  | "ID_VIEWED"
  | "EXPORTED"
  | "DELETED"
  | "EXPIRED";

interface AuditOptions {
  event: AuditEvent;
  agentId?: string;
  linkId?: string;
  request?: NextRequest | Request;
  metadata?: Record<string, unknown>;
}

export function buildAuditLogData(opts: AuditOptions) {
  const { event, agentId, linkId, request, metadata } = opts;

  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  if (request) {
    if (process.env.AUDIT_STORE_IP === "true") {
      ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        undefined;
    }
    userAgent = request.headers.get("user-agent") ?? undefined;
    if (userAgent && userAgent.length > 200) {
      userAgent = userAgent.slice(0, 200);
    }
  }

  return {
    event,
    agentId: agentId ?? null,
    linkId: linkId ?? null,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };
}

export async function writeAuditLog(opts: AuditOptions): Promise<void> {
  try {
    await db.auditLog.create({
      data: buildAuditLogData(opts),
    });
  } catch {
    // Never throw from audit — don't break user flows over logging
    console.error("[audit] Failed to write audit log");
  }
}
