import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const submissions = await db.formSubmission.findMany({
    where: { formId: params.id },
    include: {
      formLink: { select: { clientName: true, clientEmail: true, clientPhone: true } },
      _count: { select: { values: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ submissions });
}
