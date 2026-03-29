"use client";

import { useEffect, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import { isDocumentTemplatesEnabledClient } from "@/lib/feature-flags";

interface SystemTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: "FORM" | "SECURE_LINK" | "DOCUMENT";
  isFeatured: boolean;
  complianceGuarded: boolean;
  coreFieldLabels: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { label: "All", icon: LayoutGrid },
  { label: "Insurance", icon: Shield },
  { label: "Banking", icon: Building2 },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Mortgage", icon: Home },
  { label: "HR & Compliance", icon: Users },
  { label: "General", icon: LayoutGrid },
] as const;

type CategoryLabel = (typeof CATEGORIES)[number]["label"];
type TypeTab = "ALL" | "DOCUMENT" | "FORM" | "SECURE_LINK";

const TYPE_TABS: Array<{ key: TypeTab; label: string; icon: React.ElementType }> = [
  { key: "ALL", label: "All", icon: LayoutGrid },
  { key: "DOCUMENT", label: "Docs", icon: FileSignature },
  { key: "FORM", label: "Forms", icon: FileText },
  { key: "SECURE_LINK", label: "Links", icon: Link2 },
];

const CATEGORY_ICON: Record<string, React.ElementType> = Object.fromEntries(
  CATEGORIES.map((category) => [category.label, category.icon]),
);

const ICON_COLOR: Record<string, string> = {
  Insurance: "text-blue-600 bg-blue-50 border-blue-100",
  Banking: "text-emerald-600 bg-emerald-50 border-emerald-100",
  Compliance: "text-violet-600 bg-violet-50 border-violet-100",
  Mortgage: "text-orange-500 bg-orange-50 border-orange-100",
  "HR & Compliance": "text-pink-600 bg-pink-50 border-pink-100",
  General: "text-slate-500 bg-slate-50 border-slate-100",
};

export function TemplatePickerModal({ open, onClose }: Props) {
  const router = useRouter();
  const documentTemplatesEnabled = isDocumentTemplatesEnabledClient();
  const [category, setCategory] = useState<CategoryLabel>("All");
  const [typeTab, setTypeTab] = useState<TypeTab>(documentTemplatesEnabled ? "ALL" : "FORM");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) setUsingId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, category, typeTab]);

  async function handleUse(template: SystemTemplate) {
    setError(null);
    setUsingId(template.id);
    try {
      if (template.type === "SECURE_LINK") {
        onClose();
        router.push(`/dashboard/new?template=${encodeURIComponent(template.id)}`);
        return;
      }
      if (template.type === "DOCUMENT") {
        onClose();
        router.push(`/dashboard/templates/${template.id}/use`);
        return;
      }
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply template.");
      if (data?.type === "form" && typeof data.formId === "string") {
        onClose();
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

  const filtered = search.trim()
    ? templates.filter(
        (template) =>
          template.title.toLowerCase().includes(search.toLowerCase()) ||
          (template.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  const secureLinks = filtered.filter((template) => template.type === "SECURE_LINK");
  const forms = filtered.filter((template) => template.type === "FORM");
  const documents = filtered.filter((template) => template.type === "DOCUMENT");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[86vh] flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Start from a Template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a template to pre-fill your next workflow.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3 border-b border-border space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(documentTemplatesEnabled ? TYPE_TABS : TYPE_TABS.filter((tab) => tab.key !== "DOCUMENT")).map((tab) => {
              const Icon = tab.icon;
              const active = typeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setTypeTab(tab.key);
                    setSearch("");
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex sm:hidden gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setCategory(label);
                  setSearch("");
                }}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  category === label
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground border border-border"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-secondary border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden sm:flex flex-col w-44 shrink-0 border-r border-border bg-secondary/40 py-3 gap-0.5 overflow-y-auto">
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
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium transition-colors text-left ${
                    active
                      ? "bg-card text-foreground border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </aside>

          <div className="flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            ) : loading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <Search className="w-7 h-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {search ? `No results for "${search}"` : "No templates in this category."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {documentTemplatesEnabled && documents.length > 0 ? (
                  <section>
                    <div className="flex items-center gap-2 mb-2.5">
                      <FileSignature className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-semibold text-foreground">Document Templates</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {documents.map((template) => (
                        <ModalCard key={template.id} template={template} onUse={handleUse} loadingId={usingId} />
                      ))}
                    </div>
                  </section>
                ) : null}
                {secureLinks.length > 0 ? (
                  <section>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-foreground">Secure Links</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {secureLinks.map((template) => (
                        <ModalCard key={template.id} template={template} onUse={handleUse} loadingId={usingId} />
                      ))}
                    </div>
                  </section>
                ) : null}
                {forms.length > 0 ? (
                  <section>
                    <div className="flex items-center gap-2 mb-2.5">
                      <FileText className="w-3.5 h-3.5 text-violet-600" />
                      <span className="text-xs font-semibold text-foreground">Intake Forms</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {forms.map((template) => (
                        <ModalCard key={template.id} template={template} onUse={handleUse} loadingId={usingId} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalCard({
  template,
  onUse,
  loadingId,
}: {
  template: SystemTemplate;
  onUse: (template: SystemTemplate) => void;
  loadingId: string | null;
}) {
  const Icon = CATEGORY_ICON[template.category] ?? LayoutGrid;
  const iconStyle = ICON_COLOR[template.category] ?? "text-muted-foreground bg-muted border-border";
  const isLoading = loadingId === template.id;

  return (
    <div
      className={`group rounded-xl border bg-card p-3 flex gap-3 items-start cursor-pointer hover:border-primary/25 hover:shadow-sm transition-all ${
        template.isFeatured ? "border-primary/20" : "border-border"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold text-foreground leading-snug">{template.title}</p>
          <div className="flex items-center gap-0.5 shrink-0">
            {template.complianceGuarded ? (
              <ShieldCheck className="w-3 h-3 text-blue-500" aria-label="Compliance Guarded" />
            ) : null}
            {template.isFeatured ? <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> : null}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{template.description ?? ""}</p>
        <button
          type="button"
          onClick={() => onUse(template)}
          disabled={isLoading}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              Use this template
              <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
