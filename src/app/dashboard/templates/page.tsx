"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, FileText, Link2, Star, ShieldCheck,
  Shield, Building2, Home, Users, LayoutGrid, Search, ArrowRight,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface SystemTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: "FORM" | "SECURE_LINK";
  isFeatured: boolean;
  usageCount: number;
  complianceGuarded: boolean;
}

// ── category config ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "All",            icon: LayoutGrid,  color: "text-muted-foreground" },
  { label: "Insurance",      icon: Shield,      color: "text-blue-600" },
  { label: "Banking",        icon: Building2,   color: "text-emerald-600" },
  { label: "Compliance",     icon: ShieldCheck, color: "text-violet-600" },
  { label: "Mortgage",       icon: Home,        color: "text-orange-500" },
  { label: "HR & Compliance",icon: Users,       color: "text-pink-600" },
  { label: "General",        icon: LayoutGrid,  color: "text-slate-500" },
] as const;

type CategoryLabel = typeof CATEGORIES[number]["label"];

const CATEGORY_ICON: Record<string, React.ElementType> = Object.fromEntries(
  CATEGORIES.map((c) => [c.label, c.icon])
);

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.label, c.color])
);

const CATEGORY_BG: Record<string, string> = {
  Insurance:       "bg-blue-50 border-blue-100",
  Banking:         "bg-emerald-50 border-emerald-100",
  Compliance:      "bg-violet-50 border-violet-100",
  Mortgage:        "bg-orange-50 border-orange-100",
  "HR & Compliance": "bg-pink-50 border-pink-100",
  General:         "bg-slate-50 border-slate-100",
  All:             "bg-muted border-border",
};

// ── card ──────────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  loading,
}: {
  template: SystemTemplate;
  onUse: (t: SystemTemplate) => void;
  loading: boolean;
}) {
  const Icon = CATEGORY_ICON[template.category] ?? LayoutGrid;
  const iconColor = CATEGORY_COLOR[template.category] ?? "text-muted-foreground";
  const iconBg = CATEGORY_BG[template.category] ?? "bg-muted border-border";

  return (
    <div
      className={`group rounded-xl border bg-card flex flex-col transition-all duration-150 hover:shadow-md hover:border-primary/20 ${
        template.isFeatured ? "border-primary/25" : "border-border"
      }`}
    >
      {/* Card header */}
      <div className="p-4 pb-3 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">
              {template.title}
            </h3>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {template.complianceGuarded && (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" aria-label="Compliance Guarded" />
              )}
              {template.isFeatured && (
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {template.description ?? "No description."}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            template.type === "FORM"
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {template.type === "FORM"
              ? <FileText className="w-3 h-3" />
              : <Link2 className="w-3 h-3" />}
            {template.type === "FORM" ? "Form" : "Secure Link"}
          </span>
          {template.complianceGuarded && (
            <span className="text-[10px] text-blue-600 font-medium">Guarded</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onUse(template)}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 group-hover:gap-1.5"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <>Use <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" /></>}
        </button>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryLabel>("All");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const query = category === "All" ? "" : `?category=${encodeURIComponent(category)}`;
        const res = await fetch(`/api/templates${query}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Failed to load templates.");
        if (!cancelled) setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load templates.");
          setTemplates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [category]);

  async function handleUse(template: SystemTemplate) {
    setError(null);
    setUsingId(template.id);
    try {
      if (template.type === "SECURE_LINK") {
        router.push(`/dashboard/new?template=${encodeURIComponent(template.id)}`);
        return;
      }
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply template.");
      if (data?.type === "form" && typeof data.formId === "string") {
        router.push(`/dashboard/forms/${data.formId}`);
        return;
      }
      throw new Error("Template applied but no form was created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template.");
      setUsingId(null);
    }
  }

  // Filter by search query
  const filtered = search.trim()
    ? templates.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : templates;

  const secureLinks = filtered.filter((t) => t.type === "SECURE_LINK");
  const forms = filtered.filter((t) => t.type === "FORM");
  const total = templates.length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="ui-page-title">Template Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built templates for secure links and intake forms — one click to get started.
          </p>
        </div>
        {!loading && total > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> templates
            </span>
          </div>
        )}
      </div>

      {/* ── Search + category tabs ── */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm bg-secondary border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Category tabs — horizontally scrollable */}
        <div
          ref={tabsRef}
          className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {CATEGORIES.map(({ label, icon: Icon }) => {
            const active = category === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { setCategory(label); setSearch(""); }}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="h-52 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No templates found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? `No results for "${search}"` : "No templates in this category yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Secure Links section */}
          {secureLinks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-foreground">Secure Links</h2>
                <span className="text-xs text-muted-foreground">
                  — pre-fills the secure link form
                </span>
                <div className="flex-1 h-px bg-border ml-1" />
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {secureLinks.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={handleUse}
                    loading={usingId === t.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Forms section */}
          {forms.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-semibold text-foreground">Intake Forms</h2>
                <span className="text-xs text-muted-foreground">
                  — creates a custom form with pre-built fields
                </span>
                <div className="flex-1 h-px bg-border ml-1" />
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {forms.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={handleUse}
                    loading={usingId === t.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-4 pt-2 border-t border-border text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Featured
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-blue-500" /> Compliance Guarded
          </span>
        </div>
      )}
    </div>
  );
}
