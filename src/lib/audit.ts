import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export type AuditEvent =
  | "LINK_CREATED"
  | "LINK_SENT"
  | "LINK_OPENED"
  | "FORM_OPENED"
  | "FORM_SUBMITTED"
  | "SUBMITTED"
  | "REVEALED"
  | "SSN_OPENED"
  | "SSN_SUBMITTED"
  | "SSN_REVEALED"
  | "ID_UPLOADED"
  | "ID_VIEWED"
  | "EXPORTED"
  | "DELETED"
  | "EXPIRED"
  | "LOGIN_FAILED"
  | "ADMIN_BAN"
  | "ADMIN_UNBAN"
  | "ADMIN_DELETE_ACCOUNT"
  | "TRANSFER_CREATED"
  | "TRANSFER_DELETED"
  | "TRANSFER_PREVIEW_OPENED"
  | "TRANSFER_FILE_PREVIEWED"
  | "TRANSFER_FILE_DOWNLOADED"
  | "BILLING_CHECKOUT_STARTED"
  | "BILLING_FIRST_PURCHASE"
  | "BILLING_PLAN_UPGRADED"
  | "BILLING_PLAN_DOWNGRADED"
  | "BILLING_SUBSCRIPTION_CANCELLED"
  | "BILLING_PAYMENT_FAILED";

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
