import { put } from "@vercel/blob";
import { createHash } from "crypto";
import { nanoid } from "nanoid";

export interface PageDimension {
  page: number;
  widthPts: number;
  heightPts: number;
}

export interface PdfPipelineResult {
  blobUrl: string;
  documentHash: string;
  pages: PageDimension[];
  originalName: string;
}

/**
 * Upload a PDF to Vercel Blob, compute its SHA-256 hash,
 * and extract page dimensions (in PDF points) using pdfjs-dist.
 *
 * Coordinates returned are in PDF user units (points at scale 1).
 * Field placement stores positions as 0–1 fractions of these dimensions,
 * which are then converted back to points when embedding via pdf-lib.
 */
export async function processPdf(
  buffer: Buffer,
  originalName: string
): Promise<PdfPipelineResult> {
  // 1. Compute SHA-256 hash of the original bytes
  const documentHash = createHash("sha256").update(buffer).digest("hex");

  // 2. Upload to Vercel Blob
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `signing/${nanoid(12)}_${safeName}`;
  const blob = await put(key, buffer, {
    access: "public",
    contentType: "application/pdf",
  });

  // 3. Extract page dimensions using pdfjs-dist (no canvas needed — just metadata)
  const pages = await extractPageDimensions(buffer);

  return {
    blobUrl: blob.url,
    documentHash,
    pages,
    originalName,
  };
}

async function extractPageDimensions(buffer: Buffer): Promise<PageDimension[]> {
  // Primary: pdfjs-dist (most accurate viewport dimensions)
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    const uint8 = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data: uint8, disableWorker: true, verbosity: 0 }).promise;
    const dimensions: PageDimension[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      dimensions.push({ page: i, widthPts: vp.width, heightPts: vp.height });
      page.cleanup();
    }
    if (dimensions.length > 0) return dimensions;
  } catch (pdfjsErr) {
    console.warn("[pdf-pipeline] pdfjs extraction failed, falling back to pdf-lib:", pdfjsErr);
  }

  // Fallback: pdf-lib (already used elsewhere, very reliable)
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
    return pdfDoc.getPages().map((page, idx) => {
      const { width, height } = page.getSize();
      return { page: idx + 1, widthPts: width, heightPts: height };
    });
  } catch (pdfLibErr) {
    console.error("[pdf-pipeline] pdf-lib fallback also failed:", pdfLibErr);
    return [{ page: 1, widthPts: 612, heightPts: 792 }];
  }
}

/**
 * Convert percentage-based field coordinates back to PDF points.
 * Used server-side when embedding fields into the final signed PDF.
 *
 * pdf-lib uses bottom-left origin, so we flip the Y axis.
 */
export function pctToPdfPts(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidthPts: number,
  pageHeightPts: number
): { x: number; y: number; width: number; height: number } {
  const pdfX = x * pageWidthPts;
  const pdfWidth = width * pageWidthPts;
  const pdfHeight = height * pageHeightPts;
  // Flip Y: PDF origin is bottom-left, our y=0 is top-left
  const pdfY = pageHeightPts - (y * pageHeightPts) - pdfHeight;
  return { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
}
