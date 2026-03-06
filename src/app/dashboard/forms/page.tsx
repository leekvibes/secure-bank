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
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Forms</h1>
          <p className="text-sm text-slate-500 mt-1">
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

      {/* Table or empty state */}
      {forms.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-14 text-center">
          <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <FileText className="w-5 h-5 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">No forms yet</p>
          <p className="text-sm text-slate-400 mb-5">
            Create a custom form to collect exactly the data your clients need to submit.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/forms/new">Create form</Link>
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table head */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_90px_100px_150px_32px] items-center gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Form</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Fields</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Submissions</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Created</span>
            <span />
          </div>

          {/* Rows */}
          {forms.map((form, i) => (
            <Link
              key={form.id}
              href={`/dashboard/forms/${form.id}`}
              className={`flex sm:grid sm:grid-cols-[1fr_80px_90px_100px_150px_32px] items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group ${
                i < forms.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              {/* Name */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
                  form.status === "ARCHIVED"
                    ? "bg-slate-50 border-slate-100"
                    : "bg-blue-50 border-blue-100"
                }`}>
                  {form.status === "ARCHIVED"
                    ? <Archive className="w-3.5 h-3.5 text-slate-400" />
                    : <FileText className="w-3.5 h-3.5 text-blue-600" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                    {form.title}
                  </p>
                  {form.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5 hidden sm:block">
                      {form.description}
                    </p>
                  )}
                  {/* Mobile meta */}
                  <div className="flex items-center gap-2 mt-0.5 sm:hidden text-xs text-slate-400">
                    <span>{form._count.fields} fields</span>
                    <span>·</span>
                    <span>{form._count.submissions} submissions</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="hidden sm:block">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
                  form.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
                    : "bg-slate-100 text-slate-500 ring-slate-200/60"
                }`}>
                  {form.status === "ACTIVE" ? "Active" : "Archived"}
                </span>
              </div>

              {/* Fields count */}
              <div className="hidden sm:block text-right">
                <span className="text-sm font-semibold text-slate-700">{form._count.fields}</span>
              </div>

              {/* Submissions count */}
              <div className="hidden sm:block text-right">
                <span className="text-sm font-semibold text-slate-700">{form._count.submissions}</span>
              </div>

              {/* Created date */}
              <div className="hidden sm:block">
                <span className="text-xs text-slate-400">{formatDate(form.createdAt)}</span>
              </div>

              {/* Chevron */}
              <div className="flex justify-end ml-auto sm:ml-0">
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
