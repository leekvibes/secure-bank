import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";

// GET /api/signing/requests/[id]/download
//
// Query params:
//   ?type=signed   (default) — assembled signed PDF (all signers complete)
//   ?type=original            — original unsigned PDF
//   ?type=cert                — Certificate of Completion PDF
//
// Returns the PDF as an inline/attachment stream (proxied through the API
// so the Blob URL is never exposed client-side and ownership is enforced).
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const type = new URL(req.url).searchParams.get("type") ?? "signed";

  const request = await db.docSignRequest.findUnique({
    where: { id: params.id },
    select: {
      agentId: true,
      title: true,
      originalName: true,
      blobUrl: true,
      signedBlobUrl: true,
      status: true,
      certificate: { select: { blobUrl: true } },
    },
  });

  if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
  if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

  let blobUrl: string | null = null;
  let fileName: string;

  const safeName = (request.title ?? request.originalName ?? "document")
    .replace(/[^a-zA-Z0-9._\- ]/g, "_")
    .trim();

  if (type === "cert") {
    blobUrl = request.certificate?.blobUrl ?? null;
    fileName = `certificate_${safeName}.pdf`;
    if (!blobUrl) return apiError(404, "NOT_READY", "Certificate of Completion has not been generated yet.");
  } else if (type === "original") {
    blobUrl = request.blobUrl ?? null;
    fileName = request.originalName ?? `${safeName}.pdf`;
    if (!blobUrl) return apiError(404, "NOT_READY", "Original document is not available.");
  } else {
    // signed (default)
    blobUrl = request.signedBlobUrl ?? null;
    fileName = `signed_${safeName}.pdf`;
    if (!blobUrl) {
      if (request.status !== "COMPLETED") {
        return apiError(409, "NOT_COMPLETE", "Signing is not yet complete. The assembled PDF is only available after all parties have signed.");
      }
      return apiError(404, "NOT_READY", "Signed PDF is not available yet.");
    }
  }

  // Proxy the PDF through the API (ownership already verified above)
  const upstream = await fetch(blobUrl);
  if (!upstream.ok) {
    return apiError(502, "UPSTREAM_ERROR", "Failed to fetch document from storage.");
  }

  const disposition = type === "cert" ? "attachment" : "inline";
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
