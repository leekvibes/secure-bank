import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { isTwilioConfigured } from "@/lib/sms";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkCard } from "@/components/link-card";

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

  const [links, twilioEnabled] = await Promise.all([
    db.secureLink.findMany({
      where: { agentId: session.user.id },
      include: { submission: { select: { id: true, revealedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    Promise.resolve(isTwilioConfigured()),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Secure Links</h1>
          <p className="text-sm text-slate-500 mt-1">
            {links.length} link{links.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="w-4 h-4" />
            New link
          </Link>
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6" />
          </div>
          <p className="font-medium text-slate-600 mb-1">No links yet</p>
          <p className="text-sm">Create your first secure link to get started.</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/new">Create secure link</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} twilioEnabled={twilioEnabled} />
          ))}
        </div>
      )}
    </div>
  );
}
