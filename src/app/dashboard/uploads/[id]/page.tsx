import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { IdUploadViewer } from "@/components/id-upload-viewer";

export const metadata: Metadata = {
  title: "Upload Details",
};

export default async function IdUploadPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const upload = await db.idUpload.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: {
      link: true,
    },
  });

  if (!upload) notFound();

  const auditLogs = await db.auditLog.findMany({
    where: { linkId: upload.linkId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <IdUploadViewer
      upload={{
        id: upload.id,
        linkId: upload.linkId,
        clientName: upload.link.clientName,
        hasBack: !!upload.backFilePath,
        viewedAt: upload.viewedAt,
        viewCount: upload.viewCount,
        deleteAt: upload.deleteAt,
        createdAt: upload.createdAt,
        link: { id: upload.link.id },
      }}
      auditLogs={auditLogs}
    />
  );
}
