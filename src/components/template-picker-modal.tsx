"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, FileText, Link2, Star, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Category = "All" | "Insurance" | "Banking" | "Compliance" | "Mortgage" | "HR & Compliance" | "General";

interface SystemTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: "FORM" | "SECURE_LINK";
  isFeatured: boolean;
  complianceGuarded: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: Category[] = ["All", "Insurance", "Banking", "Compliance", "Mortgage", "HR & Compliance", "General"];

export function TemplatePickerModal({ open, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("All");
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, category]);

  async function handleUseTemplate(template: SystemTemplate) {
    setError(null);
    setUsingId(template.id);
    try {
      if (template.type === "SECURE_LINK") {
        onClose();
        router.push(`/dashboard/new?template=${encodeURIComponent(template.id)}`);
        return;
      }

      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply template.");
      if (data?.type === "form" && typeof data?.formId === "string") {
        onClose();
        router.push(`/dashboard/forms/${data.formId}`);
        return;
      }
      throw new Error("Template applied but no form was created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template.");
    } finally {
      setUsingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Start from a Template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose a pre-built template to speed up setup.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category filters */}
        <div className="px-5 pt-3 pb-3 border-b border-border shrink-0">
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : loading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#00A3FF]" />
            </div>
          ) : templates.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              No templates found in this category.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-xl border bg-card p-4 flex flex-col ${
                    template.isFeatured ? "border-primary/30 bg-primary/[0.02]" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{template.title}</h3>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {template.complianceGuarded && (
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500" aria-label="Compliance Guarded" />
                      )}
                      {template.isFeatured && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] flex-1">
                    {template.description ?? "No description provided."}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
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
                    <span className="text-[10px] text-muted-foreground">{template.category}</span>
                  </div>

                  <Button
                    type="button"
                    className="mt-3 h-8 text-xs"
                    onClick={() => handleUseTemplate(template)}
                    disabled={usingId !== null}
                  >
                    {usingId === template.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : "Use Template"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
