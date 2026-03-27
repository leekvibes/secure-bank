import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { DocSignDetail } from "@/components/docsign-detail";

export default async function DocSignDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth");

  const doc = await db.docSignRequest.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: { auditLogs: { orderBy: { createdAt: "asc" } } },
  });

  if (!doc) notFound();

  return <DocSignDetail doc={JSON.parse(JSON.stringify(doc))} />;
}
