import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SubmissionViewer } from "@/components/submission-viewer";
import { decryptFields, maskValue } from "@/lib/crypto";

export const metadata: Metadata = {
  title: "Submission Details",
};

interface Props {
  params: { id: string };
}

export default async function SubmissionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const submission = await db.submission.findFirst({
    where: {
      id: params.id,
      link: { agentId: session.user.id }, // agents can only see their own
    },
    include: {
      link: true,
    },
  });

  if (!submission) notFound();

  // Fetch audit logs for this link
  const auditLogs = await db.auditLog.findMany({
    where: { linkId: submission.linkId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let maskedSsn: string | null = null;
  if (submission.link.linkType === "SSN_ONLY") {
    try {
      const encryptedFields = JSON.parse(submission.encryptedData) as Record<string, string>;
      const fields = decryptFields(encryptedFields);
      if (fields.ssn) {
        maskedSsn = maskValue(fields.ssn);
      }
    } catch {
      maskedSsn = null;
    }
  }

  return (
    <SubmissionViewer
      submission={submission}
      auditLogs={auditLogs}
      maskedSsn={maskedSsn}
    />
  );
}
