"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText, Link2, Star, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";

type Category = "All" | "Insurance" | "Banking" | "Compliance" | "Mortgage";

interface SystemTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: "FORM" | "SECURE_LINK";
  isFeatured: boolean;
  usageCount: number;
}

const CATEGORIES: Category[] = ["All", "Insurance", "Banking", "Compliance", "Mortgage"];

export default function TemplatesPage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("All");
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadTemplates() {
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

    loadTemplates();
    return () => { cancelled = true; };
  }, [category]);

  async function handleUseTemplate(template: SystemTemplate) {
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
      if (data?.type === "form" && typeof data?.formId === "string") {
        router.push(`/dashboard/forms/${data.formId}`);
        return;
      }
      throw new Error("Template applied but no form was created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template.");
      setUsingId(null);
    }
  }

  const featuredCount = templates.filter((t) => t.isFeatured).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="ui-page-title">Template Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built templates for secure links and intake forms. One click to get started.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2 shrink-0">
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span>{templates.length > 0 ? `${templates.length} templates` : "Loading..."}</span>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              category === item
                ? "bg-[#00A3FF]/10 text-[#0077CC] border border-[#00A3FF]/30"
                : "bg-secondary text-muted-foreground border border-border hover:bg-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Featured callout */}
      {!loading && featuredCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{featuredCount} featured template{featuredCount > 1 ? "s" : ""} for this category</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#00A3FF]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No templates available for this category yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`rounded-xl border bg-card p-4 flex flex-col transition-shadow hover:shadow-sm ${
                template.isFeatured ? "border-primary/30 bg-primary/[0.02]" : "border-border"
              }`}
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">
                  {template.title}
                </h3>
                {template.isFeatured && (
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] flex-1">
                {template.description ?? "No description provided."}
              </p>

              {/* Type + category */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
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
                <span className="text-[10px] font-medium text-muted-foreground">{template.category}</span>
              </div>

              {/* CTA */}
              <Button
                type="button"
                className="mt-4 h-9 text-sm w-full"
                onClick={() => handleUseTemplate(template)}
                disabled={usingId !== null}
              >
                {usingId === template.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : "Use Template"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
