import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { processPdf } from "@/lib/signing/pdf-pipeline";

// POST /api/signing/requests/[id]/document
// Upload the PDF, run the pipeline (Blob upload + page dimensions + hash)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  try {
    // Verify ownership
    const request = await db.docSignRequest.findUnique({
      where: { id: params.id },
      select: { id: true, agentId: true, status: true },
    });

    if (!request) return apiError(404, "NOT_FOUND", "Signing request not found.");
    if (request.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");
    if (request.status !== "DRAFT") return apiError(409, "CONFLICT", "Cannot replace document after sending.");

    // Parse multipart form
    const formData = await req.formData().catch(() => null);
    if (!formData) return apiError(400, "BAD_REQUEST", "Invalid form data.");

    const file = formData.get("file");
    if (!file || typeof file === "string") return apiError(400, "BAD_REQUEST", "PDF file is required.");

    const fileObj = file as File;
    if (fileObj.type !== "application/pdf") return apiError(400, "BAD_REQUEST", "Only PDF files are accepted.");
    if (fileObj.size > 25 * 1024 * 1024) return apiError(400, "BAD_REQUEST", "File must be under 25 MB.");

    const buffer = Buffer.from(await fileObj.arrayBuffer());
    const originalName = fileObj.name || "document.pdf";

    // Run pipeline: upload to Blob + extract page dims + hash
    const result = await processPdf(buffer, originalName);

    // Delete existing page records if re-uploading
    await db.docSignPage.deleteMany({ where: { requestId: request.id } });

    // Persist everything in a transaction
    await db.$transaction([
      db.docSignRequest.update({
        where: { id: request.id },
        data: {
          blobUrl: result.blobUrl,
          documentHash: result.documentHash,
          originalName: result.originalName,
        },
      }),
      ...result.pages.map((p) =>
        db.docSignPage.create({
          data: {
            requestId: request.id,
            page: p.page,
            widthPts: p.widthPts,
            heightPts: p.heightPts,
          },
        })
      ),
      db.docSignAuditLog.create({
        data: {
          requestId: request.id,
          event: "DOCUMENT_UPLOADED",
          metadata: JSON.stringify({
            originalName,
            pageCount: result.pages.length,
            documentHash: result.documentHash,
          }),
        },
      }),
    ]);

    return apiSuccess({
      blobUrl: result.blobUrl,
      documentHash: result.documentHash,
      pages: result.pages,
    });
  } catch (err) {
    console.error("[signing/document/upload]", err);
    return apiError(500, "SERVER_ERROR", "Failed to process document.");
  }
}
