import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const template = await db.docSignTemplate.findUnique({
    where: { id: params.id },
    include: { recipientSlots: { orderBy: { slotIndex: "asc" } } },
  });

  if (!template) return apiError(404, "NOT_FOUND", "Template not found.");
  if (template.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

  return apiSuccess({ template });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Sign in required.");

  const template = await db.docSignTemplate.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true },
  });

  if (!template) return apiError(404, "NOT_FOUND", "Template not found.");
  if (template.agentId !== session.user.id) return apiError(403, "FORBIDDEN", "Access denied.");

  await db.docSignTemplate.delete({ where: { id: params.id } });
  return apiSuccess({ deleted: true });
}
