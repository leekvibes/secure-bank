import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestsTable } from "@/components/requests-table";

export const metadata: Metadata = {
  title: "Secure Links",
};

export default async function LinksPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const q = (searchParams?.q ?? "").trim();
  const hasQuery = q.length > 0;
  const qFilter = hasQuery
    ? {
        OR: [
          { clientName: { contains: q } },
          { clientEmail: { contains: q } },
          { clientPhone: { contains: q } },
          { destination: { contains: q } },
          { destinationLabel: { contains: q } },
          { token: { contains: q } },
        ],
      }
    : {};

  await Promise.all([
    db.secureLink.updateMany({
      where: {
        agentId: session.user.id,
        status: { notIn: ["SUBMITTED", "EXPIRED"] },
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    }),
    db.formLink.updateMany({
      where: {
        form: { agentId: session.user.id },
        status: { notIn: ["SUBMITTED", "EXPIRED"] },
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    }),
  ]);

  let secureLinks: any[] = [];
  try {
    secureLinks = await db.secureLink.findMany({
      where: { agentId: session.user.id, ...qFilter },
      include: {
        submission: { select: { id: true, revealedAt: true } },
        idUpload: { select: { id: true, viewedAt: true } },
        sends: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { method: true, recipient: true, createdAt: true },
        },
        _count: { select: { sends: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    secureLinks = await db.secureLink.findMany({
      where: { agentId: session.user.id, ...qFilter },
      include: {
        submission: { select: { id: true, revealedAt: true } },
        idUpload: { select: { id: true, viewedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    secureLinks = secureLinks.map((l) => ({ ...l, sends: [], _count: { sends: 0 } }));
  }

  const formLinkFilter = hasQuery
    ? {
        OR: [
          { clientName: { contains: q } },
          { clientEmail: { contains: q } },
          { token: { contains: q } },
          { form: { title: { contains: q } } },
        ],
      }
    : {};

  let formLinks: any[] = [];
  try {
    formLinks = await db.formLink.findMany({
      where: {
        form: { agentId: session.user.id },
        ...formLinkFilter,
      },
      include: {
        form: { select: { id: true, title: true } },
        submission: { select: { id: true, viewedAt: true } },
        sends: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { method: true, recipient: true, createdAt: true },
        },
        _count: { select: { sends: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    formLinks = await db.formLink.findMany({
      where: {
        form: { agentId: session.user.id },
        ...formLinkFilter,
      },
      include: {
        form: { select: { id: true, title: true } },
        submission: { select: { id: true, viewedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    formLinks = formLinks.map((l) => ({ ...l, sends: [], _count: { sends: 0 } }));
  }

  const mappedFormLinks = formLinks.map((fl: any) => ({
    id: fl.id,
    token: fl.token,
    linkType: "CUSTOM_FORM",
    clientName: fl.clientName,
    clientPhone: fl.clientPhone,
    clientEmail: fl.clientEmail,
    destination: fl.destination,
    status: fl.status,
    expiresAt: fl.expiresAt,
    createdAt: fl.createdAt,
    submission: fl.submission
      ? { id: fl.submission.id, revealedAt: fl.submission.viewedAt }
      : null,
    idUpload: null,
    sends: fl.sends ?? [],
    _count: fl._count ?? { sends: 0 },
    formId: fl.form.id,
    formTitle: fl.form.title,
    isFormLink: true,
  }));

  const allLinks = [...secureLinks, ...mappedFormLinks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="ui-page-title">Secure Links</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {allLinks.length} secure link{allLinks.length !== 1 ? "s" : ""} -- click a row to view details.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="w-4 h-4" />
            Create Secure Link
          </Link>
        </Button>
      </div>

      <form method="get" className="max-w-md">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search client, destination, token, email, phone"
          className="h-10"
        />
      </form>

      {allLinks.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed p-14 text-center">
          <div className="w-11 h-11 bg-muted/60 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <Link2 className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No secure links yet</p>
          <p className="text-sm text-muted-foreground mb-5">
            Create your first secure link to start collecting client data.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/new">Create secure link</Link>
          </Button>
        </div>
      ) : (
        <RequestsTable links={allLinks} />
      )}
    </div>
  );
}
