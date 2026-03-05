import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText, ChevronRight, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function FormsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const forms = await db.form.findMany({
    where: { agentId: session.user.id },
    include: {
      _count: { select: { fields: true, submissions: true, links: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forms</h1>
          <p className="text-sm text-slate-500 mt-0.5">Build custom secure data collection forms</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/forms/new">
            <Plus className="w-4 h-4" />
            New form
          </Link>
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <p className="font-medium text-slate-600 mb-1">No forms yet</p>
          <p className="text-sm text-slate-400 mb-5">Create a custom form to collect exactly the data you need.</p>
          <Button asChild size="sm">
            <Link href="/dashboard/forms/new">Create form</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {forms.map((form) => (
            <Link
              key={form.id}
              href={`/dashboard/forms/${form.id}`}
              className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 px-4 py-3 transition-colors group"
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                {form.status === "ARCHIVED" ? (
                  <Archive className="w-4 h-4 text-slate-400" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">{form.title}</span>
                  {form.status === "ARCHIVED" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 ring-1 ring-slate-200/60">
                      Archived
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                  <span>{form._count.fields} field{form._count.fields !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{form._count.submissions} submission{form._count.submissions !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>Created {formatDate(form.createdAt)}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
