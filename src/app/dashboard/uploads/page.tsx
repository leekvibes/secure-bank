import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import Link from "next/link";
import { Upload, Eye, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Uploads",
};

export default async function UploadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const uploads = await db.idUpload.findMany({
    where: { agentId: session.user.id },
    include: { link: { select: { clientName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Uploads</h1>
        <p className="text-sm text-slate-500 mt-1">
          Encrypted ID photos submitted by clients via your secure upload links.
        </p>
      </div>

      {/* Table or empty state */}
      {uploads.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-14 text-center">
          <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Upload className="w-5 h-5 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">No uploads yet</p>
          <p className="text-sm text-slate-400">
            ID uploads will appear here once clients submit via your ID upload links.
          </p>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
          {/* Table head */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_150px_150px_100px_32px] items-center gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Client</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Sides</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Uploaded</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Deletes after</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
            <span />
          </div>

          {uploads.map((upload, i) => (
            <Link
              key={upload.id}
              href={`/dashboard/uploads/${upload.id}`}
              className={`flex sm:grid sm:grid-cols-[1fr_80px_150px_150px_100px_32px] items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group ${
                i < uploads.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              {/* Client name */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                  {upload.link.clientName ?? "Anonymous"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 sm:hidden">
                  {formatDate(upload.createdAt)}
                </p>
              </div>

              {/* Sides */}
              <div className="hidden sm:block text-center">
                <span className="text-sm font-semibold text-slate-700">
                  {upload.backFilePath ? "2" : "1"}
                </span>
                <span className="text-xs text-slate-400 ml-1">side{upload.backFilePath ? "s" : ""}</span>
              </div>

              {/* Uploaded date */}
              <div className="hidden sm:block">
                <span className="text-xs text-slate-500">{formatDate(upload.createdAt)}</span>
              </div>

              {/* Delete at */}
              <div className="hidden sm:block">
                {upload.deleteAt ? (
                  <span className="text-xs text-slate-500">{formatDate(upload.deleteAt)}</span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Viewed badge */}
              <div>
                {upload.viewedAt ? (
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
