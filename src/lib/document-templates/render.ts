import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentTemplateSchema } from "@/lib/document-templates/types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 54;
const BODY_SIZE = 11;
const LINE_HEIGHT = 15;

function interpolate(text: string, values: Record<string, string>) {
  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key: string) => values[key] ?? "");
}

function wrapText(text: string, maxWidth: number, measure: (line: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderDocumentTemplatePdf(
  schema: DocumentTemplateSchema,
  values: Record<string, string>,
  enabledClauseIds: string[],
): Promise<Buffer> {
  const enabled = new Set(enabledClauseIds);
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;

  function ensureSpace(required: number) {
    if (y - required >= MARGIN_BOTTOM) return;
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
  }

  for (const block of schema.blocks) {
    if (block.clauseId && !enabled.has(block.clauseId)) continue;

    if (block.kind === "spacer") {
      y -= block.size ?? 16;
      continue;
    }

    const font = block.kind === "heading" ? fontBold : fontRegular;
    const size = block.kind === "heading" ? 16 : BODY_SIZE;
    const text = interpolate(block.text ?? "", values).trim();
    const lines = wrapText(text, maxWidth, (line) => font.widthOfTextAtSize(line, size));
    const lh = block.kind === "heading" ? 22 : LINE_HEIGHT;

    ensureSpace(lines.length * lh + 10);
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN_X,
        y,
        size,
        font,
        color: rgb(0.12, 0.12, 0.14),
      });
      y -= lh;
    }
    y -= block.kind === "heading" ? 8 : 6;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

