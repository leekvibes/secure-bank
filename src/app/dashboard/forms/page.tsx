import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText, Archive, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Forms",
};

export default async function FormsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const forms = await db.form.findMany({
    where: { agentId: session.user.id },
    include: { _count: { select: { fields: true, submissions: true, links: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8 animate-fade-in">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="ui-page-title">Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build custom secure intake forms and send unique links to clients.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/forms/new">
            <Plus className="w-4 h-4" />
            New form
          </Link>
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed p-14 text-center">
          <div className="w-11 h-11 bg-surface-2 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <FileText className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No forms yet</p>
          <p className="text-sm text-muted-foreground mb-5">
            Create a custom form to collect exactly the data your clients need to submit.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/forms/new">Create form</Link>
          </Button>
        </div>
      ) : (
        <div className="ui-table-wrap">
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_90px_100px_150px_32px] items-center gap-4 px-5 py-3 border-b border-border/40 ui-table-header">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Form</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Fields</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Submissions</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</span>
            <span />
          </div>

          {forms.map((form, i) => (
            <Link
              key={form.id}
              href={`/dashboard/forms/${form.id}`}
              className={`ui-table-row flex sm:grid sm:grid-cols-[1fr_80px_90px_100px_150px_32px] items-center gap-3 sm:gap-4 px-5 py-4 group ${
                i < forms.length - 1 ? "border-b border-border/30" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
                  form.status === "ARCHIVED"
                    ? "bg-surface-2 border-border/40"
                    : "bg-primary/10 border-primary/20"
                }`}>
                  {form.status === "ARCHIVED"
                    ? <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                    : <FileText className="w-3.5 h-3.5 text-primary" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {form.title}
                  </p>
                  {form.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5 hidden sm:block">
                      {form.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 sm:hidden text-xs text-muted-foreground">
                    <span>{form._count.fields} fields</span>
                    <span>·</span>
                    <span>{form._count.submissions} submissions</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:block">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                  form.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-surface-2 text-muted-foreground"
                }`}>
                  {form.status === "ACTIVE" ? "Active" : "Archived"}
                </span>
              </div>

              <div className="hidden sm:block text-right">
                <span className="text-sm font-semibold text-foreground">{form._count.fields}</span>
              </div>

              <div className="hidden sm:block text-right">
                <span className="text-sm font-semibold text-foreground">{form._count.submissions}</span>
              </div>

              <div className="hidden sm:block">
                <span className="text-xs text-muted-foreground">{formatDate(form.createdAt)}</span>
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
