"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye, ChevronRight, CreditCard, Shield, ClipboardList, Camera, FileText, Inbox,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { SubmissionCategory } from "@/lib/submissions-index";

interface SubmissionEntry {
  id: string;
  clientName: string | null;
  type: string;
  category: SubmissionCategory;
  typeLabel: string;
  createdAt: string;
  viewedAt: string | null;
  href: string;
}

type CategoryTab = "ALL" | SubmissionCategory;
type StatusFilter = "ALL" | "NEW" | "VIEWED";

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string }> = {
  BANKING_INFO: { icon: CreditCard,    bg: "bg-primary/10 text-primary" },
  SSN_ONLY:     { icon: Shield,        bg: "bg-violet-500/10 text-violet-500" },
  FULL_INTAKE:  { icon: ClipboardList, bg: "bg-emerald-500/10 text-emerald-500" },
  ID_UPLOAD:    { icon: Camera,        bg: "bg-orange-500/10 text-orange-500" },
  CUSTOM_FORM:  { icon: FileText,      bg: "bg-violet-500/10 text-violet-500" },
};

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: "ALL",          label: "All Submissions" },
  { key: "BANKING_INFO", label: "Banking" },
  { key: "SSN_ONLY",     label: "Social Security" },
  { key: "FULL_INTAKE",  label: "Full Intake" },
  { key: "ID_UPLOAD",    label: "Document Upload" },
  { key: "CUSTOM_FORM",  label: "Forms" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL",    label: "All" },
  { key: "NEW",    label: "New" },
  { key: "VIEWED", label: "Viewed" },
];

export function SubmissionsTable({
  submissions,
}: {
  submissions: SubmissionEntry[];
}) {
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const byCategory =
    categoryTab === "ALL"
      ? submissions
      : submissions.filter((s) => s.category === categoryTab);

  const filtered =
    statusFilter === "ALL"
      ? byCategory
      : statusFilter === "NEW"
      ? byCategory.filter((s) => !s.viewedAt)
      : byCategory.filter((s) => !!s.viewedAt);

  const categoryCounts = CATEGORY_TABS.reduce((acc, { key }) => {
    acc[key] =
      key === "ALL"
        ? submissions.length
        : submissions.filter((s) => s.category === key).length;
    return acc;
  }, {} as Record<CategoryTab, number>);

  const statusCounts = STATUS_FILTERS.reduce((acc, { key }) => {
    acc[key] =
      key === "ALL"
        ? byCategory.length
        : key === "NEW"
        ? byCategory.filter((s) => !s.viewedAt).length
        : byCategory.filter((s) => !!s.viewedAt).length;
    return acc;
  }, {} as Record<StatusFilter, number>);

  return (
    <div className="space-y-5">
      <div className="border-b border-border/50">
        <nav className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
          {CATEGORY_TABS.map(({ key, label }) => {
            const isActive = categoryTab === key;
            const count = categoryCounts[key];
            return (
              <button
                key={key}
                onClick={() => { setCategoryTab(key); setStatusFilter("ALL"); }}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2",
                  isActive
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    "ml-2 text-xs tabular-nums",
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
              statusFilter === key
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-card text-muted-foreground border border-border/60 hover:border-primary/30 hover:text-foreground"
            )}
          >
            {label}
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-semibold px-1",
                statusFilter === key ? "bg-slate-50/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {statusCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl border-dashed py-14 text-center">
          <div className="w-10 h-10 bg-muted/60 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/40">
            <Inbox className="w-4 h-4 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No submissions</p>
          <p className="text-sm text-muted-foreground">
            {categoryTab === "ALL"
              ? "No submissions match this filter."
              : `No ${CATEGORY_TABS.find((t) => t.key === categoryTab)?.label.toLowerCase()} submissions found.`}
          </p>
        </div>
      ) : (
        <div className="ui-table-wrap">
          <div className="hidden sm:grid sm:grid-cols-[1fr_180px_150px_100px_32px] items-center gap-4 px-5 py-2.5 ui-table-header border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Client</span>
            <span>Type</span>
            <span>Submitted</span>
            <span>Status</span>
            <span />
          </div>

          <div className="divide-y divide-border/30">
            {filtered.map((sub) => {
              const catMeta = CATEGORY_META[sub.category] ?? { icon: ClipboardList, bg: "bg-muted/60 text-muted-foreground" };
              const CatIcon = catMeta.icon;
              return (
                <Link
                  key={sub.id}
                  href={sub.href}
                  className="group flex sm:grid sm:grid-cols-[1fr_180px_150px_100px_32px] items-center gap-3 sm:gap-4 px-5 py-3.5 transition-all duration-200 ui-table-row"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", catMeta.bg)}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                        {sub.clientName ?? <span className="text-muted-foreground font-normal italic">Anonymous</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 sm:hidden truncate">
                        {sub.typeLabel}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block text-sm text-muted-foreground truncate">
                    {sub.typeLabel}
                  </div>

                  <div className="hidden sm:block text-xs text-muted-foreground tabular-nums">
                    {formatDate(sub.createdAt)}
                  </div>

                  <div className="shrink-0">
                    {sub.viewedAt ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 bg-purple-500/10 text-purple-600 ring-purple-500/20">
                        <Eye className="w-3 h-3" />
                        Viewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 bg-emerald-500/10 text-emerald-600 ring-emerald-500/20">
                        New
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end ml-auto sm:ml-0">
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
