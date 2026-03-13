import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTransferDownloadNotification } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; fileId: string } }
) {
  const transfer = await db.fileTransfer.findUnique({
    where: { token: params.token },
    include: {
      files: { where: { id: params.fileId } },
      agent: { select: { email: true, displayName: true, notificationEmail: true } },
    },
  });

  if (!transfer || transfer.files.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (transfer.expiresAt < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  const file = transfer.files[0];

  // Increment download count
  await db.fileTransferFile.update({
    where: { id: file.id },
    data: { downloadCount: { increment: 1 } },
  });

  // Notify agent on first download if enabled
  if (transfer.notifyOnDownload && file.downloadCount === 0) {
    const notifyEmail = transfer.agent.notificationEmail ?? transfer.agent.email;
    sendTransferDownloadNotification({
      agentEmail: notifyEmail,
      agentName: transfer.agent.displayName,
      title: transfer.title,
      fileName: file.fileName,
    });
  }

  return NextResponse.redirect(file.blobUrl);
}
