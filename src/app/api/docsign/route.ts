import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { encryptAndSaveFile } from "@/lib/files";
import { generateToken } from "@/lib/tokens";
import { apiError, apiSuccess } from "@/lib/api-response";
import { addHours } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError(400, "BAD_REQUEST", "Invalid form data.");

  const file = formData.get("file");
  if (!file || typeof file === "string") return apiError(400, "BAD_REQUEST", "PDF file is required.");

  const title = String(formData.get("title") || "").trim() || null;
  const message = String(formData.get("message") || "").trim() || null;
  const clientName = String(formData.get("clientName") || "").trim() || null;
  const clientEmail = String(formData.get("clientEmail") || "").trim() || null;
  const expiresIn = parseInt(String(formData.get("expiresIn") || "72"), 10) || 72;

  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) return apiError(400, "BAD_REQUEST", "Only PDF and image files are accepted.");
  if (file.size > 20 * 1024 * 1024) return apiError(400, "BAD_REQUEST", "File must be under 20 MB.");

  const bytes = await file.arrayBuffer();
  const filePath = await encryptAndSaveFile(Buffer.from(bytes));

  const request = await db.docSignRequest.create({
    data: {
      token: generateToken(),
      title,
      message,
      clientName,
      clientEmail,
      originalFilePath: filePath,
      originalName: file.name || null,
      expiresAt: addHours(new Date(), expiresIn),
      agentId: session.user.id,
    },
  });

  return apiSuccess({ id: request.id, token: request.token }, 201);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const requests = await db.docSignRequest.findMany({
    where: { agentId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, token: true, title: true, status: true,
      clientName: true, clientEmail: true, originalName: true,
      expiresAt: true, completedAt: true, createdAt: true,
    },
  });

  return apiSuccess({ requests });
}
