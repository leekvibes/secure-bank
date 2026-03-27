import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";

const feedbackSchema = z.object({
  category: z.enum(["BUG", "FEATURE", "UX", "OTHER"]),
  message: z.string().min(10, "Please provide at least 10 characters.").max(2000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  let body: unknown;
  try { body = await req.json(); } catch { return apiError(400, "INVALID_JSON", "Invalid request."); }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[k] = (v as string[])[0];
    }
    return apiError(422, "VALIDATION_ERROR", "Please fix the errors below.", { fieldErrors });
  }

  const { category, message } = parsed.data;

  await db.feedback.create({
    data: { userId: session.user.id, category, message },
  });

  // Notify support — fire and forget
  try {
    const { sendFeedbackNotification } = await import("@/lib/email");
    if (typeof sendFeedbackNotification === "function") {
      sendFeedbackNotification({
        agentEmail: session.user.email ?? "",
        agentName: session.user.name ?? "Unknown",
        category,
        message,
      });
    }
  } catch { /* non-critical */ }

  return apiSuccess({ success: true }, 201);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const items = await db.feedback.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return apiSuccess({ items });
}
