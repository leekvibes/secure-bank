import { PDFDocument } from "pdf-lib";

export const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/bmp",
  "image/heic",
]);

export const SUPPORTED_DOC_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const ACCEPTED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/tiff", "image/bmp", "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const ACCEPTED_EXTENSIONS =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.tiff,.bmp,.heic";

// ── Image → PDF ──────────────────────────────────────────────────────────────

async function imageToPdf(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  let jpgOrPng: Uint8Array = new Uint8Array(buffer);
  let format: "jpg" | "png" = "png";

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    format = "jpg";
  } else if (mimeType !== "image/png") {
    // Convert any other format (webp, gif, tiff, bmp, heic) → PNG via sharp
    const sharp = (await import("sharp")).default;
    jpgOrPng = new Uint8Array(await sharp(buffer).png().toBuffer());
    format = "png";
  }

  const embeddedImage =
    format === "jpg"
      ? await pdfDoc.embedJpg(jpgOrPng)
      : await pdfDoc.embedPng(jpgOrPng);

  // Use the image's natural dimensions as the page size (in points, 72 dpi baseline)
  // Scale so max dimension is ~8.5in (612pt) to keep it a reasonable page
  const MAX_PTS = 792; // 11in
  const scale = Math.min(1, MAX_PTS / Math.max(embeddedImage.width, embeddedImage.height));
  const w = Math.round(embeddedImage.width * scale);
  const h = Math.round(embeddedImage.height * scale);

  const page = pdfDoc.addPage([w, h]);
  page.drawImage(embeddedImage, { x: 0, y: 0, width: w, height: h });

  return Buffer.from(await pdfDoc.save());
}

// ── Word doc → PDF via CloudConvert ─────────────────────────────────────────

interface CCTask {
  id: string;
  name: string;
  status: string;
  result?: {
    form?: { url: string; parameters: Record<string, string> };
    files?: { url: string; filename: string }[];
  };
}

interface CCJobResponse {
  data: {
    id: string;
    status: string;
    tasks: CCTask[];
  };
}

async function docToPdf(buffer: Buffer, filename: string): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Word document conversion requires CLOUDCONVERT_API_KEY to be set. Please convert to PDF manually and re-upload, or ask your admin to configure the conversion service."
    );
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "docx";

  // 1. Create job with three tasks: upload → convert → export
  const createRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        "upload-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "upload-file",
          input_format: ext,
          output_format: "pdf",
          engine: "libreoffice",
        },
        "export-file": {
          operation: "export/url",
          input: "convert-file",
          inline: false,
          archive_multiple_files: false,
        },
      },
    }),
  });

  if (!createRes.ok) {
    const err = (await createRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Conversion service error: ${err.message ?? createRes.status}`);
  }

  const job = (await createRes.json()) as CCJobResponse;
  const uploadTask = job.data.tasks.find((t) => t.name === "upload-file");
  if (!uploadTask?.result?.form) {
    throw new Error("Conversion service did not return an upload URL.");
  }

  // 2. Upload the file to the signed URL
  const { url: uploadUrl, parameters: uploadParams } = uploadTask.result.form;
  const uploadForm = new FormData();
  for (const [k, v] of Object.entries(uploadParams)) {
    uploadForm.append(k, v);
  }
  uploadForm.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" }),
    filename
  );

  const uploadRes = await fetch(uploadUrl, { method: "POST", body: uploadForm });
  if (!uploadRes.ok) {
    throw new Error(`File upload to conversion service failed: ${uploadRes.status}`);
  }

  // 3. Poll until finished (max ~50s, 25 × 2s)
  const jobId = job.data.id;
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));

    const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const statusData = (await statusRes.json()) as CCJobResponse;

    if (statusData.data.status === "finished") {
      const exportTask = statusData.data.tasks.find((t) => t.name === "export-file");
      const fileUrl = exportTask?.result?.files?.[0]?.url;
      if (!fileUrl) throw new Error("Conversion finished but no output file was produced.");

      const pdfRes = await fetch(fileUrl);
      if (!pdfRes.ok) throw new Error("Failed to download converted PDF.");
      return Buffer.from(await pdfRes.arrayBuffer());
    }

    if (statusData.data.status === "error") {
      const failedTask = statusData.data.tasks.find((t) => t.status === "error");
      throw new Error(`Conversion failed${failedTask ? ` in task "${failedTask.name}"` : ""}.`);
    }
  }

  throw new Error("Document conversion timed out. Please try again or upload as PDF.");
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function convertToPdf(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ buffer: Buffer; name: string }> {
  if (mimeType === "application/pdf") {
    return { buffer, name: filename };
  }

  if (SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    const pdfBuffer = await imageToPdf(buffer, mimeType);
    const baseName = filename.replace(/\.[^.]+$/, "");
    return { buffer: pdfBuffer, name: `${baseName}.pdf` };
  }

  if (SUPPORTED_DOC_TYPES.has(mimeType)) {
    const pdfBuffer = await docToPdf(buffer, filename);
    const baseName = filename.replace(/\.[^.]+$/, "");
    return { buffer: pdfBuffer, name: `${baseName}.pdf` };
  }

  throw new Error(
    `Unsupported file type "${mimeType}". Please upload a PDF, image, or Word document.`
  );
}
