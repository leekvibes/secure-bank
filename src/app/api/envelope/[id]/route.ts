import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

// GET /api/envelope/[id]
// Public — no auth required. Returns enough data to verify a signed envelope.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      originalName: true,
      status: true,
      signingMode: true,
      completedAt: true,
      createdAt: true,
      documentHash: true,
      signedDocumentHash: true,
      authLevel: true,
      agent: {
        select: { displayName: true, agencyName: true, company: true },
      },
      recipients: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          completedAt: true,
          declinedAt: true,
          ipAddress: true,
          emailOtpVerifiedAt: true,
          smsOtpVerifiedAt: true,
          fields: {
            select: {
              id: true,
              type: true,
              page: true,
              signatureId: true,
              completedAt: true,
            },
            where: {
              type: { in: ["SIGNATURE", "INITIALS"] },
            },
          },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        select: { id: true, event: true, createdAt: true, ipAddress: true, recipientId: true },
      },
    },
  });

  if (!request) return apiError(404, "NOT_FOUND", "Envelope not found.");
  if (request.status === "DRAFT") return apiError(404, "NOT_FOUND", "Envelope not found.");

  function maskIp(ip: string | null): string | null {
    if (!ip) return null;
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
    return ip.slice(0, 16) + "…";
  }

  const data = {
    id: request.id,
    title: request.title?.trim() || request.originalName || "Untitled Document",
    status: request.status,
    signingMode: request.signingMode,
    completedAt: request.completedAt,
    createdAt: request.createdAt,
    documentHash: request.documentHash,
    signedDocumentHash: request.signedDocumentHash,
    agentName: request.agent.displayName,
    agencyName: request.agent.agencyName ?? request.agent.company ?? null,
    recipients: request.recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
      status: r.status,
      completedAt: r.completedAt,
      declinedAt: r.declinedAt,
      ipAddress: maskIp(r.ipAddress),
      authMethod:
        r.emailOtpVerifiedAt ? "Email OTP" :
        r.smsOtpVerifiedAt ? "SMS OTP" :
        "Secure Link",
      signatures: r.fields.map((f) => ({
        signatureId: f.signatureId,
        type: f.type,
        page: f.page,
        completedAt: f.completedAt,
      })),
    })),
    auditLog: request.auditLogs.map((e) => ({
      id: e.id,
      event: e.event,
      createdAt: e.createdAt,
      ipAddress: maskIp(e.ipAddress),
    })),
  };

  return apiSuccess(data);
}
