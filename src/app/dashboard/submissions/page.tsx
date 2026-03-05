import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import { Inbox, Eye, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { LINK_TYPES, type LinkType } from "@/lib/utils";

export default async function SubmissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const submissions = await db.submission.findMany({
    where: { link: { agentId: session.user.id } },
    include: { link: { select: { clientName: true, linkType: true, id: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Submissions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Encrypted data submitted by clients via your secure links.
        </p>
      </div>

      {/* Table or empty state */}
      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-14 text-center">
          <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Inbox className="w-5 h-5 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">No submissions yet</p>
          <p className="text-sm text-slate-400">
            Submissions will appear here once clients complete your secure links.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table head */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_150px_150px_100px_32px] items-center gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Client</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Submitted</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
            <span />
          </div>

          {submissions.map((sub, i) => (
            <Link
              key={sub.id}
              href={`/dashboard/submissions/${sub.id}`}
              className={`flex sm:grid sm:grid-cols-[1fr_150px_150px_100px_32px] items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group ${
                i < submissions.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              {/* Client name */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                  {sub.link.clientName ?? "Anonymous"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 sm:hidden">
                  {LINK_TYPES[sub.link.linkType as LinkType] ?? sub.link.linkType}
                </p>
              </div>

              {/* Link type */}
              <div className="hidden sm:block">
                <span className="text-xs text-slate-500">
                  {LINK_TYPES[sub.link.linkType as LinkType] ?? sub.link.linkType}
                </span>
              </div>

              {/* Date */}
              <div className="hidden sm:block">
                <span className="text-xs text-slate-500">{formatDate(sub.createdAt)}</span>
              </div>

              {/* Viewed badge */}
              <div>
                {sub.revealedAt ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-purple-200/60 bg-purple-50 text-purple-700">
                    <Eye className="w-3 h-3" />
                    Viewed
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-emerald-200/60 bg-emerald-50 text-emerald-700">
                    New
                  </span>
                )}
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
