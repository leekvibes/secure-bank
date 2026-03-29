"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDocumentTemplatesEnabledClient } from "@/lib/feature-flags";

type Block = {
  id?: string;
  kind: "heading" | "paragraph" | "spacer";
  text?: string;
  size?: number;
  clauseId?: string;
  editable?: boolean;
};
type VariableDef = {
  key: string;
  label: string;
  type: "text" | "multiline" | "address" | "date_text" | "currency_usd" | "email" | "phone" | "number";
  required: boolean;
  editable: boolean;
  maxLength?: number;
};
type ClauseDef = { id: string; label: string; required?: boolean; defaultEnabled?: boolean };
type DocSchema = { title: string; roles: string[]; variables: VariableDef[]; clauses?: ClauseDef[]; blocks: Block[] };

interface TemplateDetail {
  id: string;
  title: string;
  description: string | null;
  type: "DOCUMENT" | "FORM" | "SECURE_LINK";
  docSchemaJson: string | null;
  docDefaultValuesJson: string | null;
  docVersion: number;
  docStatus?: string;
}

function interpolate(text: string, values: Record<string, string>) {
  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key: string) => values[key] ?? "");
}

function defaultValueForType(type: VariableDef["type"]): string {
  if (type === "date_text") return new Date().toISOString().slice(0, 10);
  return "";
}

export default function UseDocumentTemplatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [schema, setSchema] = useState<DocSchema | null>(null);
  const [requestTitle, setRequestTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [fullTextEditing, setFullTextEditing] = useState(false);
  const [blockOverrides, setBlockOverrides] = useState<Record<string, string>>({});
  const [enabledClauses, setEnabledClauses] = useState<string[]>([]);

  useEffect(() => {
    if (!isDocumentTemplatesEnabledClient()) {
      setError("Document templates are currently disabled.");
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadTemplate() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Failed to load template.");
        const detail = data?.template as TemplateDetail | undefined;
        if (!detail) throw new Error("Template data missing.");
        if (detail.type !== "DOCUMENT") throw new Error("This template is not a document template.");
        if ((detail as { docStatus?: string }).docStatus && (detail as { docStatus?: string }).docStatus !== "PUBLISHED") {
          throw new Error("This document template is not published.");
        }
        if (!detail.docSchemaJson) throw new Error("Document schema missing.");
        const parsed = JSON.parse(detail.docSchemaJson) as DocSchema;
        if (!parsed.blocks || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.variables)) {
          throw new Error("Document schema is invalid.");
        }

        const defaultValuesRaw = detail.docDefaultValuesJson ? JSON.parse(detail.docDefaultValuesJson) : {};
        const nextValues: Record<string, string> = {};
        for (const variable of parsed.variables) {
          const pre = defaultValuesRaw?.[variable.key];
          nextValues[variable.key] = typeof pre === "string" ? pre : defaultValueForType(variable.type);
        }
        const defaultClauses = (parsed.clauses ?? [])
          .filter((clause) => clause.required || clause.defaultEnabled)
          .map((clause) => clause.id);

        if (!cancelled) {
          setTemplate(detail);
          setSchema(parsed);
          setRequestTitle(detail.title);
          setValues(nextValues);
          setEnabledClauses(defaultClauses);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load template.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const visibleBlocks = useMemo(() => {
    if (!schema) return [];
    const enabled = new Set(enabledClauses);
    return schema.blocks.filter((block) => !block.clauseId || enabled.has(block.clauseId));
  }, [schema, enabledClauses]);

  const editableBlocks = useMemo(
    () => visibleBlocks.filter((block) => block.kind === "paragraph" && block.editable),
    [visibleBlocks],
  );

  function toggleClause(clauseId: string, forced: boolean) {
    if (forced) return;
    setEnabledClauses((prev) => {
      if (prev.includes(clauseId)) return prev.filter((item) => item !== clauseId);
      return [...prev, clauseId];
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!template) return;

    setSubmitting(true);
    setError(null);
    try {
      const useRes = await fetch(`/api/templates/${encodeURIComponent(template.id)}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "DOCUMENT", titleOverride: requestTitle.trim() || undefined }),
      });
      const useData = await useRes.json().catch(() => ({}));
      if (!useRes.ok) throw new Error(useData?.error ?? "Failed to create document request.");
      if (useData?.type !== "document" || typeof useData?.templateInstanceId !== "string" || typeof useData?.requestId !== "string") {
        throw new Error("Invalid document initialization response.");
      }

      const renderRes = await fetch(
        `/api/document-templates/instances/${encodeURIComponent(useData.templateInstanceId)}/render`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values, enabledClauseIds: enabledClauses, blockOverrides }),
        },
      );
      const renderData = await renderRes.json().catch(() => ({}));
      if (!renderRes.ok) {
        const message = renderData?.error?.message ?? renderData?.error ?? "Failed to render document.";
        throw new Error(message);
      }

      router.push(
        `/dashboard/signing/new?mode=document-template&requestId=${encodeURIComponent(
          useData.requestId,
        )}&templateInstanceId=${encodeURIComponent(useData.templateInstanceId)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start document request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !template || !schema) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/dashboard/templates">
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </Link>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Unable to load document template."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/dashboard/templates">
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="ui-page-title mt-2 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-amber-600" />
          Use Document Template
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill required values, preview the document, then continue to signing fields.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Informational template only, not legal advice.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[360px_1fr] gap-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-6 h-fit">
          <div>
            <Label htmlFor="requestTitle">Request Title</Label>
            <Input
              id="requestTitle"
              value={requestTitle}
              onChange={(event) => setRequestTitle(event.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Variables</p>
            {schema.variables.map((variable) => (
              <div key={variable.key}>
                <Label htmlFor={variable.key}>
                  {variable.label}
                  {variable.required ? <span className="text-red-600"> *</span> : null}
                </Label>
                {variable.type === "multiline" || variable.type === "address" ? (
                  <textarea
                    id={variable.key}
                    value={values[variable.key] ?? ""}
                    required={variable.required}
                    maxLength={variable.maxLength}
                    onChange={(event) => setValues((prev) => ({ ...prev, [variable.key]: event.target.value }))}
                    className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm resize-none min-h-[86px]"
                  />
                ) : (
                  <Input
                    id={variable.key}
                    type={variable.type === "email" ? "email" : variable.type === "number" ? "number" : "text"}
                    value={values[variable.key] ?? ""}
                    required={variable.required}
                    maxLength={variable.maxLength}
                    onChange={(event) => setValues((prev) => ({ ...prev, [variable.key]: event.target.value }))}
                    className="mt-1.5"
                  />
                )}
              </div>
            ))}
          </div>

          {(schema.clauses ?? []).length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Optional Clauses</p>
              {(schema.clauses ?? []).map((clause) => {
                const checked = clause.required || enabledClauses.includes(clause.id);
                return (
                  <label key={clause.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(clause.required)}
                      onChange={() => toggleClause(clause.id, Boolean(clause.required))}
                    />
                    <span className={clause.required ? "text-foreground font-medium" : "text-foreground"}>
                      {clause.label}
                      {clause.required ? " (required)" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fullTextEditing}
                onChange={(event) => setFullTextEditing(event.target.checked)}
              />
              <span className="text-foreground font-medium">Enable advanced text editing</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Turn on to rewrite editable clauses and paragraphs before rendering.
            </p>
          </div>

          {fullTextEditing && editableBlocks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Editable Paragraphs</p>
              {editableBlocks.map((block, index) => {
                const key = block.id ?? `block_${index}`;
                return (
                  <div key={key}>
                    <Label htmlFor={key}>Paragraph {index + 1}</Label>
                    <textarea
                      id={key}
                      value={blockOverrides[key] ?? block.text ?? ""}
                      onChange={(event) =>
                        setBlockOverrides((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm resize-none min-h-[100px]"
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          <Button type="submit" disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue to Signing Setup"}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Document Preview</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Version {template.docVersion} preview before signature field placement.
          </p>
          <div className="rounded-lg border border-border bg-white p-6 space-y-3 min-h-[560px]">
            {visibleBlocks.map((block, index) => {
              if (block.kind === "spacer") {
                return <div key={`spacer-${index}`} style={{ height: Math.min(40, Math.max(4, block.size ?? 16)) }} />;
              }
              const blockKey = block.id ?? `block_${index}`;
              const sourceText = blockOverrides[blockKey] ?? block.text ?? "";
              const text = interpolate(sourceText, values);
              if (block.kind === "heading") {
                return (
                  <h3 key={`heading-${index}`} className="text-lg font-semibold text-slate-900">
                    {text}
                  </h3>
                );
              }
              return (
                <p key={`paragraph-${index}`} className="text-sm leading-6 text-slate-800 whitespace-pre-wrap">
                  {text}
                </p>
              );
            })}
          </div>
        </div>
      </form>
    </div>
  );
}
