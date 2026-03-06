import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import { Inbox, Eye, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { buildSubmissionsIndex } from "@/lib/submissions-index";

export const metadata: Metadata = {
  title: "Submissions",
};

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const q = (searchParams?.q ?? "").trim();
  const hasQuery = q.length > 0;

  const [legacySubmissions, formSubmissions, idUploads] = await Promise.all([
    db.submission.findMany({
      where: {
        link: {
          agentId: session.user.id,
          ...(hasQuery ? { clientName: { contains: q } } : {}),
        },
      },
      include: { link: { select: { clientName: true, linkType: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.formSubmission.findMany({
      where: {
        form: { agentId: session.user.id },
        ...(hasQuery
          ? {
              OR: [
                { formLink: { clientName: { contains: q } } },
                { form: { title: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        form: { select: { title: true } },
        formLink: { select: { clientName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.idUpload.findMany({
      where: {
        agentId: session.user.id,
        ...(hasQuery ? { link: { clientName: { contains: q } } } : {}),
      },
      include: { link: { select: { clientName: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const submissions = buildSubmissionsIndex(
    legacySubmissions,
    formSubmissions,
    idUploads
  );

  return (
    <div className="space-y-8 animate-fade-in">

      <div>
        <h1 className="ui-page-title">Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encrypted data submitted by clients via your secure links.
        </p>
      </div>

      <form method="get" className="max-w-md">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search client or form title"
          className="h-10"
        />
      </form>

      {submissions.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed p-14 text-center">
          <div className="w-11 h-11 bg-surface-2 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <Inbox className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No submissions yet</p>
          <p className="text-sm text-muted-foreground">
            Submissions will appear here once clients complete your secure links.
          </p>
        </div>
      ) : (
        <div className="ui-table-wrap">
          <div className="hidden sm:grid sm:grid-cols-[1fr_150px_150px_100px_32px] items-center gap-4 px-5 py-3 border-b border-border/40 ui-table-header">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <span />
          </div>

          {submissions.map((sub, i) => (
            <Link
              key={sub.id}
              href={sub.href}
              className={`ui-table-row flex sm:grid sm:grid-cols-[1fr_150px_150px_100px_32px] items-center gap-3 sm:gap-4 px-5 py-4 group ${
                i < submissions.length - 1 ? "border-b border-border/30" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {sub.clientName ?? "Anonymous"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                  {sub.typeLabel}
                </p>
              </div>

              <div className="hidden sm:block">
                <span className="text-xs text-muted-foreground">{sub.typeLabel}</span>
              </div>

              <div className="hidden sm:block">
                <span className="text-xs text-muted-foreground">{formatDate(sub.createdAt)}</span>
              </div>

              <div>
                {sub.viewedAt ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-600">
                    <Eye className="w-3 h-3" />
                    Viewed
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600">
                    New
                  </span>
                )}
              </div>

              <div className="flex justify-end ml-auto sm:ml-0">
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
