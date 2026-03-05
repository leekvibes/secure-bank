import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { NO_STORE_HEADERS } from "@/lib/http";
import {
  UPLOAD_SECURITY,
  runVirusScanPlaceholder,
  validateUploadFile,
} from "@/lib/upload-security";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const validation = validateUploadFile(file);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const clean = await runVirusScanPlaceholder(file);
  if (!clean) {
    return NextResponse.json(
      { error: "File failed security scanning." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // Validation-only endpoint. Actual storage should use private buckets only.
  return NextResponse.json(
    {
      success: true,
      metadata: {
        name: file.name,
        type: file.type,
        size: file.size,
        privateOnly: true,
        allowedTypes: UPLOAD_SECURITY.ALLOWED_EXTENSIONS,
        maxSizeBytes: UPLOAD_SECURITY.MAX_UPLOAD_SIZE_BYTES,
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}

