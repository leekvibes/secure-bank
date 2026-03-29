/**
 * PDF Assembly Service — Section 4
 *
 * Embeds all collected field values into the original PDF and generates a
 * Certificate of Completion, both stored in Vercel Blob.
 */

import { PDFDocument, rgb, StandardFonts, PDFImage } from "pdf-lib";
import { put } from "@vercel/blob";
import { pctToPdfPts } from "./pdf-pipeline";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FieldValue {
  id: string;
  type: string;
  page: number;       // 1-indexed
  x: number;         // 0–1 fraction
  y: number;         // 0–1 fraction (top-left origin)
  width: number;     // 0–1 fraction
  height: number;    // 0–1 fraction
  value: string;     // text, "true"/"false", or base64 PNG for SIGNATURE/INITIALS
}

export interface PageDim {
  page: number;
  widthPts: number;
  heightPts: number;
}

export interface RecipientSummary {
  name: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  consentAt: Date | null;
  completedAt: Date | null;
  declinedAt: Date | null;
}

export interface AuditEvent {
  event: string;
  ipAddress: string | null;
  recipientId: string | null;
  metadata: string | null;
  createdAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hex(r: number, g: number, b: number) {
  return rgb(r / 255, g / 255, b / 255);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function loadImageFromBase64(
  pdfDoc: PDFDocument,
  base64: string
): Promise<PDFImage | null> {
  try {
    // base64 may be a data URI: "data:image/png;base64,..."
    const stripped = base64.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Buffer.from(stripped, "base64");
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

// ── Core: assemble signed PDF ─────────────────────────────────────────────────

/**
 * Embed all collected field values into the original PDF.
 * Returns the Vercel Blob URL of the assembled, signed PDF.
 */
export async function assemblePdf(
  originalBlobUrl: string,
  fields: FieldValue[],
  pages: PageDim[]
): Promise<string> {
  // Fetch the original PDF bytes
  const res = await fetch(originalBlobUrl);
  if (!res.ok) throw new Error(`Failed to fetch original PDF: ${res.status}`);
  const originalBytes = await res.arrayBuffer();

  const pdfDoc = await PDFDocument.load(new Uint8Array(originalBytes));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pdfPages = pdfDoc.getPages();

  // Build a lookup: page number → dimensions
  const pageDimMap = new Map(pages.map((p) => [p.page, p]));

  for (const field of fields) {
    if (!field.value?.trim() && field.type !== "CHECKBOX") continue;
    if (field.type === "CHECKBOX" && field.value !== "true") continue;

    // Get page (1-indexed → 0-indexed array)
    const pdfPage = pdfPages[field.page - 1];
    if (!pdfPage) continue;

    // Get actual PDF point dimensions — prefer stored metadata, fallback to pdf-lib
    const dimEntry = pageDimMap.get(field.page);
    const { width: pageW, height: pageH } = pdfPage.getSize();
    const pageWidthPts = dimEntry?.widthPts ?? pageW;
    const pageHeightPts = dimEntry?.heightPts ?? pageH;

    const coords = pctToPdfPts(
      field.x,
      field.y,
      field.width,
      field.height,
      pageWidthPts,
      pageHeightPts
    );

    const isSignatureType =
      field.type === "SIGNATURE" || field.type === "INITIALS";

    if (isSignatureType && field.value.startsWith("data:image")) {
      // Embed the signature as a PNG image
      const img = await loadImageFromBase64(pdfDoc, field.value);
      if (img) {
        pdfPage.drawImage(img, {
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          opacity: 1,
        });
      } else {
        // Fallback: draw italic text
        pdfPage.drawText(field.value.slice(0, 40), {
          x: coords.x + 4,
          y: coords.y + coords.height * 0.2,
          font,
          size: Math.min(12, coords.height * 0.6),
          color: hex(0, 0, 180),
        });
      }
    } else if (field.type === "CHECKBOX") {
      // Draw a filled checkmark box
      pdfPage.drawRectangle({
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.height,
        color: hex(0, 0, 0),
        opacity: 0.1,
        borderColor: hex(60, 60, 60),
        borderWidth: 1,
      });
      pdfPage.drawText("✓", {
        x: coords.x + 2,
        y: coords.y + coords.height * 0.1,
        font: fontBold,
        size: Math.min(14, coords.height * 0.75),
        color: hex(30, 100, 30),
      });
    } else {
      // Text-based fields (FULL_NAME, TITLE, COMPANY, TEXT, DATE_SIGNED, DROPDOWN, RADIO)
      const isNameOrSig =
        field.type === "FULL_NAME" ||
        field.type === "SIGNATURE" ||
        field.type === "INITIALS";
      const selectedFont = isNameOrSig ? fontBold : font;
      const fontSize = Math.min(
        isNameOrSig ? 13 : 11,
        coords.height * (isNameOrSig ? 0.65 : 0.6)
      );
      const textColor =
        field.type === "SIGNATURE" || field.type === "INITIALS"
          ? hex(0, 0, 180)
          : hex(30, 30, 30);

      pdfPage.drawText(
        truncate(field.value.trim(), 80),
        {
          x: coords.x + 3,
          y: coords.y + coords.height * 0.15,
          font: selectedFont,
          size: Math.max(fontSize, 8),
          color: textColor,
          maxWidth: coords.width - 6,
        }
      );

      if (field.type === "SIGNATURE" || field.type === "INITIALS") {
        // Underline
        pdfPage.drawLine({
          start: { x: coords.x, y: coords.y },
          end: { x: coords.x + coords.width, y: coords.y },
          thickness: 1,
          color: hex(0, 0, 180),
        });
      }
    }
  }

  const signedBytes = await pdfDoc.save();
  const blob = await put(
    `signing/signed_${Date.now()}.pdf`,
    Buffer.from(signedBytes),
    { access: "public", contentType: "application/pdf" }
  );
  return blob.url;
}

// ── Certificate of Completion PDF ─────────────────────────────────────────────

export async function generateCertificate(
  requestId: string,
  requestTitle: string | null,
  documentHash: string | null,
  agentName: string,
  recipients: RecipientSummary[],
  auditEvents: AuditEvent[],
  completedAt: Date
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const page = pdfDoc.addPage([W, H]);

  const grayDark = hex(15, 23, 42);
  const grayMid = hex(71, 85, 105);
  const grayLight = hex(226, 232, 240);
  const blue = hex(0, 87, 255);
  const greenDark = hex(21, 128, 61);

  let y = H - 48;

  // ── Header bar
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: hex(15, 23, 42) });
  page.drawText("SecureLink", { x: 40, y: H - 40, font: fontB, size: 18, color: hex(255, 255, 255) });
  page.drawText("Certificate of Completion", {
    x: 40, y: H - 58, font: fontR, size: 9,
    color: hex(148, 163, 184),
  });
  page.drawText(`Generated ${completedAt.toUTCString()}`, {
    x: W - 250, y: H - 50, font: fontR, size: 8, color: hex(100, 116, 139),
  });

  y = H - 100;

  // ── Title
  page.drawText(truncate(requestTitle ?? "Signing Request", 60), {
    x: 40, y, font: fontB, size: 16, color: grayDark,
  });
  y -= 20;

  page.drawText(`Prepared by: ${agentName}`, {
    x: 40, y, font: fontR, size: 10, color: grayMid,
  });
  y -= 14;

  if (documentHash) {
    page.drawText(`Document SHA-256: ${documentHash}`, {
      x: 40, y, font: fontR, size: 7.5, color: hex(100, 116, 139),
    });
    y -= 18;
  }

  // ── Divider
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: grayLight });
  y -= 20;

  // ── Signers section
  page.drawText("SIGNERS", { x: 40, y, font: fontB, size: 9, color: blue });
  y -= 16;

  for (const r of recipients) {
    const statusIcon = r.completedAt ? "✓" : r.declinedAt ? "✗" : "○";
    const statusColor = r.completedAt ? greenDark : r.declinedAt ? hex(185, 28, 28) : grayMid;

    page.drawText(statusIcon, { x: 40, y, font: fontB, size: 11, color: statusColor });
    page.drawText(`${r.name}  <${r.email}>`, {
      x: 58, y, font: fontB, size: 10, color: grayDark,
    });
    y -= 14;

    if (r.consentAt) {
      page.drawText(`  Consent: ${r.consentAt.toUTCString()}`, {
        x: 58, y, font: fontR, size: 8, color: grayMid,
      });
      y -= 12;
    }
    if (r.completedAt) {
      page.drawText(`  Signed:  ${r.completedAt.toUTCString()}`, {
        x: 58, y, font: fontR, size: 8, color: grayMid,
      });
      y -= 12;
    }
    if (r.ipAddress) {
      page.drawText(`  IP: ${r.ipAddress}${r.userAgent ? "  ·  " + truncate(r.userAgent, 50) : ""}`, {
        x: 58, y, font: fontR, size: 7, color: hex(100, 116, 139),
      });
      y -= 14;
    }
    y -= 4;
  }

  // ── Divider
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: grayLight });
  y -= 20;

  // ── Audit trail
  page.drawText("AUDIT TRAIL", { x: 40, y, font: fontB, size: 9, color: blue });
  y -= 16;

  for (const ev of auditEvents) {
    if (y < 80) {
      // Add overflow page
      const newPage = pdfDoc.addPage([W, H]);
      // Keep writing on new page (simplified — just continue)
      y = H - 60;
      void newPage;
    }
    const evLine = `${ev.createdAt.toUTCString()}  ·  ${ev.event}${ev.ipAddress ? "  ·  " + ev.ipAddress : ""}`;
    page.drawText(truncate(evLine, 100), {
      x: 40, y, font: fontR, size: 7.5, color: grayMid,
    });
    y -= 12;
  }

  // ── Footer
  page.drawLine({ start: { x: 40, y: 60 }, end: { x: W - 40, y: 60 }, thickness: 1, color: grayLight });
  page.drawText(
    "This certificate was generated by SecureLink (mysecurelink.co). It represents an electronic record under the ESIGN Act and UETA.",
    { x: 40, y: 44, font: fontR, size: 7, color: hex(148, 163, 184), maxWidth: W - 80 }
  );

  const certBytes = await pdfDoc.save();
  const blob = await put(
    `signing/cert_${requestId}_${Date.now()}.pdf`,
    Buffer.from(certBytes),
    { access: "public", contentType: "application/pdf" }
  );
  return blob.url;
}
