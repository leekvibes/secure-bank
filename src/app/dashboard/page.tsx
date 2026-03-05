import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isTwilioConfigured } from "@/lib/sms";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkRow } from "@/components/link-row";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  // Mark expired links
  await db.secureLink.updateMany({
    where: {
      agentId: session.user.id,
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const [links, idUploads, twilioEnabled] = await Promise.all([
    db.secureLink.findMany({
      where: { agentId: session.user.id, linkType: { not: "ID_UPLOAD" } },
      include: { submission: { select: { id: true, revealedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.secureLink.findMany({
      where: { agentId: session.user.id, linkType: "ID_UPLOAD" },
      include: { idUpload: { select: { id: true, viewedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    Promise.resolve(isTwilioConfigured()),
  ]);

  const submitted = links.filter((l) => l.status === "SUBMITTED").length;
  const pending = links.filter((l) => l.status === "CREATED" || l.status === "OPENED").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your secure collection links
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/new">
            <Plus className="w-4 h-4" />
            New link
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total links", value: links.length + idUploads.length },
          { label: "Pending", value: pending },
          { label: "Submitted", value: submitted },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-slate-200 p-4 text-center"
          >
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Links list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Secure links
        </h2>
        {links.length === 0 && idUploads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Plus className="w-5 h-5 text-slate-400" />
            </div>
            <p className="font-medium text-slate-600 mb-1">No links yet</p>
            <p className="text-sm text-slate-400 mb-5">Create your first secure link to get started.</p>
            <Button asChild size="sm">
              <Link href="/dashboard/new">Create secure link</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={{
                  ...link,
                  clientPhone: link.clientPhone,
                  submission: link.submission,
                  idUpload: null,
                }}
                twilioEnabled={twilioEnabled}
              />
            ))}
            {idUploads.map((link) => (
              <LinkRow
                key={link.id}
                link={{
                  ...link,
                  clientPhone: link.clientPhone,
                  submission: null,
                  idUpload: link.idUpload,
                }}
                twilioEnabled={twilioEnabled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
