import { db } from "@/lib/db";
import { LINK_TYPES, type LinkType } from "@/lib/utils";

function isPrismaSchemaDriftError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : "";
  return (
    message.includes("Unknown field") ||
    message.includes("does not exist in the current database") ||
    message.includes("The column") ||
    message.includes("no such column")
  );
}

export type RequestStatus = "DRAFT" | "SENT" | "OPENED" | "SUBMITTED" | "EXPIRED";

export function deriveRequestStatus(input: {
  expiresAt: Date;
  submittedAt?: Date | null;
  openedAt?: Date | null;
  sentAt?: Date | null;
  now?: Date;
}): RequestStatus {
  const now = input.now ?? new Date();
  const expired = input.expiresAt.getTime() < now.getTime();

  if (input.submittedAt) return "SUBMITTED";
  if (expired) return "EXPIRED";
  if (input.openedAt) return "OPENED";
  if (input.sentAt) return "SENT";
  return "DRAFT";
}

export function latestSentAt(
  sends: Array<{ createdAt: Date }> | undefined
): Date | null {
  if (!sends || sends.length === 0) return null;
  return sends
    .map((s) => s.createdAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

export type RequestRow = {
  id: string;
  source: "SECURE_LINK" | "FORM_LINK";
  clientName: string | null;
  requestType: string;
  status: RequestStatus;
  createdAt: Date;
  expiresAt: Date;
  sentAt: Date | null;
  latestSendMethod: string | null;
  latestRecipient: string | null;
  openedAt: Date | null;
  submittedAt: Date | null;
  href: string;
};

export async function listRequestRows(agentId: string): Promise<RequestRow[]> {
  let secureLinks: any[] = [];
  let formLinks: any[] = [];
  try {
    [secureLinks, formLinks] = await Promise.all([
      db.secureLink.findMany({
        where: { agentId },
        include: {
          submission: { select: { id: true, createdAt: true } },
          idUpload: { select: { id: true, createdAt: true } },
          sends: {
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, method: true, recipient: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.formLink.findMany({
        where: { form: { agentId } },
        include: {
          form: { select: { id: true, title: true } },
          submission: { select: { id: true, createdAt: true } },
          sends: {
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, method: true, recipient: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) throw err;
    [secureLinks, formLinks] = await Promise.all([
      db.secureLink.findMany({
        where: { agentId },
        include: {
          submission: { select: { id: true, createdAt: true } },
          idUpload: { select: { id: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.formLink.findMany({
        where: { form: { agentId } },
        include: {
          form: { select: { id: true, title: true } },
          submission: { select: { id: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);
    secureLinks = secureLinks.map((link) => ({ ...link, sends: [] }));
    formLinks = formLinks.map((link) => ({ ...link, sends: [] }));
  }

  const secureRows: RequestRow[] = secureLinks.map((link) => {
    const submittedAt = link.submittedAt ?? link.submission?.createdAt ?? link.idUpload?.createdAt ?? null;
    const sentAt = latestSentAt(link.sends);
    const status = deriveRequestStatus({
      expiresAt: link.expiresAt,
      submittedAt,
      openedAt: link.openedAt,
      sentAt,
    });
    const typeLabel =
      link.linkType === "ID_UPLOAD"
        ? "ID Upload"
        : LINK_TYPES[link.linkType as LinkType] ?? link.linkType;

    const href =
      link.linkType === "ID_UPLOAD" && link.idUpload
        ? `/dashboard/uploads/${link.idUpload.id}`
        : link.submission
        ? `/dashboard/submissions/${link.submission.id}`
        : `/dashboard`;

    return {
      id: link.id,
      source: "SECURE_LINK",
      clientName: link.clientName,
      requestType: typeLabel,
      status,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      sentAt,
      latestSendMethod: link.sends[0]?.method ?? null,
      latestRecipient: link.sends[0]?.recipient ?? null,
      openedAt: link.openedAt,
      submittedAt,
      href,
    };
  });

  const formRows: RequestRow[] = formLinks.map((link) => {
    const submittedAt = link.submittedAt ?? link.submission?.createdAt ?? null;
    const sentAt = latestSentAt(link.sends);
    const status = deriveRequestStatus({
      expiresAt: link.expiresAt,
      submittedAt,
      openedAt: link.openedAt,
      sentAt,
    });

    const href = link.submission
      ? `/dashboard/forms/${link.form.id}/submissions/${link.submission.id}`
      : `/dashboard/forms/${link.form.id}`;

    return {
      id: link.id,
      source: "FORM_LINK",
      clientName: link.clientName,
      requestType: "Form submission",
      status,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      sentAt,
      latestSendMethod: link.sends[0]?.method ?? null,
      latestRecipient: link.sends[0]?.recipient ?? null,
      openedAt: link.openedAt,
      submittedAt,
      href,
    };
  });

  return [...secureRows, ...formRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
