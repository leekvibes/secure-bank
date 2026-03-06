import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isTwilioConfigured } from "@/lib/sms";
import Link from "next/link";
import { Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestsTable } from "@/components/requests-table";

export const metadata: Metadata = {
  title: "Requests",
};

export default async function LinksPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  await db.secureLink.updateMany({
    where: {
      agentId: session.user.id,
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const twilioEnabled = isTwilioConfigured();

  let links: any[] = [];
  try {
    links = await db.secureLink.findMany({
      where: { agentId: session.user.id },
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
    links = await db.secureLink.findMany({
      where: { agentId: session.user.id },
      include: {
        submission: { select: { id: true, revealedAt: true } },
        idUpload: { select: { id: true, viewedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    links = links.map((l) => ({ ...l, sends: [], _count: { sends: 0 } }));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="ui-page-title">Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {links.length} secure link{links.length !== 1 ? "s" : ""} -- click a row to view details.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="w-4 h-4" />
            New request
          </Link>
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed p-14 text-center">
          <div className="w-11 h-11 bg-muted/60 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <Link2 className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No requests yet</p>
          <p className="text-sm text-muted-foreground mb-5">
            Create your first secure link to start collecting client data.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/new">Create secure link</Link>
          </Button>
        </div>
      ) : (
        <RequestsTable links={links} twilioEnabled={twilioEnabled} />
      )}
    </div>
  );
}
