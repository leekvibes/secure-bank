import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { buildSubmissionsIndex } from "@/lib/submissions-index";
import { SubmissionsTable } from "@/components/submissions-table";

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

  const serialized = submissions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    viewedAt: s.viewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="ui-page-title">Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""} -- encrypted data submitted by clients via your secure links.
        </p>
      </div>

      <form method="get" className="max-w-md">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search client name or form title"
          className="h-10"
        />
      </form>

      <SubmissionsTable submissions={serialized} />
    </div>
  );
}
