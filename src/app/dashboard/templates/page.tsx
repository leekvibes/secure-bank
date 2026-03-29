"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  FileSignature,
  FileText,
  Home,
  LayoutGrid,
  Link2,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { isDocumentTemplatesEnabledClient } from "@/lib/feature-flags";

interface SystemTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: "FORM" | "SECURE_LINK" | "DOCUMENT";
  isFeatured: boolean;
  usageCount: number;
  complianceGuarded: boolean;
  coreFieldLabels: string | null;
  docVersion?: number;
  docStatus?: string;
  thumbnailUrl?: string | null;
}

type TemplateTypeTab = "ALL" | "DOCUMENT" | "FORM" | "SECURE_LINK";

const TYPE_TABS: Array<{ key: TemplateTypeTab; label: string; icon: React.ElementType }> = [
  { key: "ALL", label: "All", icon: LayoutGrid },
  { key: "DOCUMENT", label: "Documents", icon: FileSignature },
  { key: "FORM", label: "Forms", icon: FileText },
  { key: "SECURE_LINK", label: "Secure Links", icon: Link2 },
];
const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  REVIEWED: "Reviewed",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const CATEGORIES = [
  { label: "All", icon: LayoutGrid, color: "text-muted-foreground" },
  { label: "Insurance", icon: Shield, color: "text-blue-600" },
  { label: "Banking", icon: Building2, color: "text-emerald-600" },
  { label: "Compliance", icon: ShieldCheck, color: "text-violet-600" },
  { label: "Mortgage", icon: Home, color: "text-orange-500" },
  { label: "HR & Compliance", icon: Users, color: "text-pink-600" },
  { label: "General", icon: LayoutGrid, color: "text-slate-500" },
] as const;

type CategoryLabel = (typeof CATEGORIES)[number]["label"];

const CATEGORY_ICON: Record<string, React.ElementType> = Object.fromEntries(
  CATEGORIES.map((category) => [category.label, category.icon]),
);
const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category.label, category.color]),
);
const CATEGORY_BG: Record<string, string> = {
  Insurance: "bg-blue-50 border-blue-100",
  Banking: "bg-emerald-50 border-emerald-100",
  Compliance: "bg-violet-50 border-violet-100",
  Mortgage: "bg-orange-50 border-orange-100",
  "HR & Compliance": "bg-pink-50 border-pink-100",
  General: "bg-slate-50 border-slate-100",
  All: "bg-muted border-border",
};

function templateBadge(type: SystemTemplate["type"]) {
  if (type === "FORM") return "bg-violet-50 text-violet-700 border-violet-200";
  if (type === "SECURE_LINK") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function templateTypeLabel(type: SystemTemplate["type"]) {
  if (type === "FORM") return "Form";
  if (type === "SECURE_LINK") return "Secure Link";
  return "Document";
}

function typeIcon(type: SystemTemplate["type"]) {
  if (type === "FORM") return <FileText className="w-3 h-3" />;
  if (type === "SECURE_LINK") return <Link2 className="w-3 h-3" />;
  return <FileSignature className="w-3 h-3" />;
}

function TemplateCard({
  template,
  onUse,
  loading,
}: {
  template: SystemTemplate;
  onUse: (template: SystemTemplate) => void;
  loading: boolean;
}) {
  const Icon = CATEGORY_ICON[template.category] ?? LayoutGrid;
  const iconColor = CATEGORY_COLOR[template.category] ?? "text-muted-foreground";
  const iconBg = CATEGORY_BG[template.category] ?? "bg-muted border-border";
  const isDocument = template.type === "DOCUMENT";
  const docStatus = template.docStatus ? DOC_STATUS_LABEL[template.docStatus] ?? template.docStatus : null;

  return (
    <div
      className={`group rounded-xl border bg-card flex flex-col transition-all duration-150 hover:shadow-md hover:border-primary/20 ${
        template.isFeatured ? "border-primary/25" : "border-border"
      }`}
    >
      <div className="p-4 pb-3 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{template.title}</h3>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {template.complianceGuarded ? (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" aria-label="Compliance Guarded" />
              ) : null}
              {template.isFeatured ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : null}
              {isDocument && docStatus ? (
                <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-1.5 py-0.5">
                  {docStatus}
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {template.description ?? "No description."}
          </p>
        </div>
      </div>

      {isDocument ? (
        <div className="px-4 pb-2">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 h-24 flex items-center justify-center">
            <div className="text-center">
              <FileSignature className="w-5 h-5 mx-auto text-muted-foreground/70" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {template.docVersion ? `v${template.docVersion}` : "Document"} template
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="px-4 pb-4 mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${templateBadge(template.type)}`}>
            {typeIcon(template.type)}
            {templateTypeLabel(template.type)}
          </span>
          {template.complianceGuarded ? <span className="text-[10px] text-blue-600 font-medium">Guarded</span> : null}
        </div>
        <button
          type="button"
          onClick={() => onUse(template)}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 group-hover:gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Use <ArrowRight className="w-3 h-3" /></>}
        </button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const documentTemplatesEnabled = isDocumentTemplatesEnabledClient();
  const [category, setCategory] = useState<CategoryLabel>("All");
  const [typeTab, setTypeTab] = useState<TemplateTypeTab>(documentTemplatesEnabled ? "ALL" : "FORM");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const params = new URLSearchParams();
        if (category !== "All") params.set("category", category);
        if (typeTab !== "ALL") params.set("type", typeTab);
        const query = params.toString();
        const res = await fetch(`/api/templates${query ? `?${query}` : ""}`);
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

    void load();
    return () => {
      cancelled = true;
    };
  }, [category, typeTab]);

  async function handleUse(template: SystemTemplate) {
    setError(null);
    setUsingId(template.id);
    try {
      if (template.type === "SECURE_LINK") {
        router.push(`/dashboard/new?template=${encodeURIComponent(template.id)}`);
        return;
      }
      if (template.type === "DOCUMENT") {
        router.push(`/dashboard/templates/${template.id}/use`);
        return;
      }
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply template.");
      if (data?.type === "form" && typeof data.formId === "string") {
        const guarded = template.complianceGuarded ? "1" : "0";
        const core = template.coreFieldLabels ? encodeURIComponent(template.coreFieldLabels) : "";
        const query = guarded === "1" ? `?guarded=1${core ? `&core=${core}` : ""}` : "";
        router.push(`/dashboard/forms/${data.formId}${query}`);
        return;
      }
      throw new Error("Template applied but no form was created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template.");
    } finally {
      if (mountedRef.current) setUsingId(null);
    }
  }

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter(
      (template) =>
        template.title.toLowerCase().includes(normalized) ||
        (template.description ?? "").toLowerCase().includes(normalized),
    );
  }, [templates, search]);

  const documents = filtered.filter((template) => template.type === "DOCUMENT");
  const forms = filtered.filter((template) => template.type === "FORM");
  const secureLinks = filtered.filter((template) => template.type === "SECURE_LINK");
  const total = templates.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="ui-page-title">Template Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Document, form, and secure-link templates in one place.
          </p>
        </div>
        {!loading && total > 0 ? (
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> templates
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(documentTemplatesEnabled ? TYPE_TABS : TYPE_TABS.filter((tab) => tab.key !== "DOCUMENT")).map((tab) => {
            const Icon = tab.icon;
            const active = typeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm bg-secondary border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          />
        </div>

        <div ref={tabsRef} className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(({ label, icon: Icon }) => {
            const active = category === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setCategory(label);
                  setSearch("");
                }}
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

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      ) : null}

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
          {documentTemplatesEnabled && documents.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileSignature className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-foreground">Document Templates</h2>
                <span className="text-xs text-muted-foreground">— real agreements with variables + e-sign fields</span>
                <div className="flex-1 h-px bg-border ml-1" />
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {documents.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={handleUse}
                    loading={usingId === template.id}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Informational templates only, not legal advice. Review with counsel before production use.
              </p>
            </section>
          ) : null}

          {secureLinks.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-foreground">Secure Links</h2>
                <span className="text-xs text-muted-foreground">— pre-fills the secure link form</span>
                <div className="flex-1 h-px bg-border ml-1" />
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {secureLinks.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={handleUse}
                    loading={usingId === template.id}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {forms.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-semibold text-foreground">Intake Forms</h2>
                <span className="text-xs text-muted-foreground">— creates a custom form with pre-built fields</span>
                <div className="flex-1 h-px bg-border ml-1" />
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {forms.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={handleUse}
                    loading={usingId === template.id}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
