import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TransferDownloadClient } from "./transfer-download-client";

export default async function TransferPage({
  params,
}: {
  params: { token: string };
}) {
  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    include: {
      files: {
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, downloadCount: true },
      },
      agent: {
        select: { displayName: true, agencyName: true, company: true, photoUrl: true },
      },
    },
  });

  if (!transfer) notFound();

  const now = new Date();
  const expired = transfer.expiresAt < now || transfer.status === "EXPIRED";
  // Do NOT consume view-once on page open — only consume on actual file access via serve route
  const alreadyDownloaded = transfer.viewOnce && transfer.status === "DOWNLOADED";

  return (
    <TransferDownloadClient
      token={params.token}
      title={transfer.title}
      message={transfer.message}
      viewOnce={transfer.viewOnce}
      expiresAt={transfer.expiresAt.toISOString()}
      expired={expired}
      alreadyDownloaded={alreadyDownloaded}
      files={transfer.files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes.toString(),
        downloadCount: f.downloadCount,
      }))}
      agent={{
        displayName: transfer.agent.displayName,
        company: transfer.agent.company ?? transfer.agent.agencyName ?? null,
        photoUrl: transfer.agent.photoUrl ?? null,
      }}
    />
  );
}
