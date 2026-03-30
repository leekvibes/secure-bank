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
type WizardStep = "SETUP" | "PARTY_A" | "PARTY_B" | "TERMS" | "REVIEW";

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

function prettifyToken(token: string) {
  return token
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderInterpolatedText(text: string, values: Record<string, string>) {
  const nodes: Array<string | JSX.Element> = [];
  const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    const [raw, key] = match;
    const start = match.index;
    if (start > cursor) nodes.push(text.slice(cursor, start));

    const resolved = (values[key] ?? "").trim();
    const display = resolved || prettifyToken(key);
    nodes.push(
      <span
        key={`${key}-${idx++}`}
        className={
          resolved
            ? "rounded bg-emerald-100 px-1 py-0.5 text-emerald-900"
            : "rounded bg-violet-100 px-1 py-0.5 text-violet-900"
        }
      >
        {display}
      </span>,
    );
    cursor = start + raw.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function isPartyAKey(key: string) {
  const normalized = normalizeKey(key);
  return normalized.startsWith("party_a_") || normalized.startsWith("seller_") || normalized.startsWith("landlord_");
}

function isPartyBKey(key: string) {
  const normalized = normalizeKey(key);
  return normalized.startsWith("party_b_") || normalized.startsWith("buyer_") || normalized.startsWith("tenant_");
}

function isTermsKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    normalized.includes("term") ||
    normalized.includes("governing") ||
    normalized.includes("consideration") ||
    normalized.includes("payment") ||
    normalized.includes("delivery") ||
    normalized.includes("custom_terms")
  );
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
  const [step, setStep] = useState<WizardStep>("SETUP");

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

  const groupedVariables = useMemo(() => {
    if (!schema) return { setup: [], partyA: [], partyB: [], terms: [] } as Record<string, VariableDef[]>;
    const partyA = schema.variables.filter((v) => isPartyAKey(v.key));
    const partyB = schema.variables.filter((v) => isPartyBKey(v.key));
    const terms = schema.variables.filter((v) => !isPartyAKey(v.key) && !isPartyBKey(v.key) && isTermsKey(v.key));
    const setup = schema.variables.filter((v) => !isPartyAKey(v.key) && !isPartyBKey(v.key) && !isTermsKey(v.key));
    return { setup, partyA, partyB, terms };
  }, [schema]);

  const stepOrder = useMemo(() => {
    const steps: WizardStep[] = ["SETUP"];
    if (groupedVariables.partyA.length > 0) steps.push("PARTY_A");
    if (groupedVariables.partyB.length > 0) steps.push("PARTY_B");
    if (groupedVariables.terms.length > 0 || (schema?.clauses?.length ?? 0) > 0 || editableBlocks.length > 0) {
      steps.push("TERMS");
    }
    steps.push("REVIEW");
    return steps;
  }, [groupedVariables.partyA.length, groupedVariables.partyB.length, groupedVariables.terms.length, schema?.clauses?.length, editableBlocks.length]);

  const currentStepIndex = stepOrder.indexOf(step);

  function requiredMissing(vars: VariableDef[]) {
    return vars.filter((variable) => variable.required && !(values[variable.key] ?? "").trim()).map((variable) => variable.label);
  }

  const stepBlockingErrors = useMemo(() => {
    if (step === "SETUP") return requiredMissing(groupedVariables.setup);
    if (step === "PARTY_A") return requiredMissing(groupedVariables.partyA);
    if (step === "PARTY_B") return requiredMissing(groupedVariables.partyB);
    if (step === "TERMS") return requiredMissing(groupedVariables.terms);
    return [];
  }, [step, groupedVariables, values]);

  function toggleClause(clauseId: string, forced: boolean) {
    if (forced) return;
    setEnabledClauses((prev) => {
      if (prev.includes(clauseId)) return prev.filter((item) => item !== clauseId);
      return [...prev, clauseId];
    });
  }

  function goNextStep() {
    if (stepBlockingErrors.length > 0) {
      setError(`Please complete required fields: ${stepBlockingErrors.slice(0, 3).join(", ")}${stepBlockingErrors.length > 3 ? "..." : ""}`);
      return;
    }
    setError(null);
    const next = stepOrder[currentStepIndex + 1];
    if (next) setStep(next);
  }

  function goPrevStep() {
    setError(null);
    const prev = stepOrder[currentStepIndex - 1];
    if (prev) setStep(prev);
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

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[400px_1fr] gap-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-6 h-fit">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template Setup</p>
            <div className="grid grid-cols-5 gap-1.5">
              {stepOrder.map((item, index) => {
                const active = item === step;
                const done = index < currentStepIndex;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      if (index <= currentStepIndex) setStep(item);
                    }}
                    className={`h-2 rounded-full ${active ? "bg-primary" : done ? "bg-emerald-500" : "bg-muted"}`}
                    aria-label={`Step ${index + 1}`}
                  />
                );
              })}
            </div>
            <p className="text-sm font-semibold text-foreground">
              {step === "SETUP" && "1. Agreement Setup"}
              {step === "PARTY_A" && `${currentStepIndex + 1}. Party A Details`}
              {step === "PARTY_B" && `${currentStepIndex + 1}. Party B Details`}
              {step === "TERMS" && `${currentStepIndex + 1}. Terms & Clauses`}
              {step === "REVIEW" && `${currentStepIndex + 1}. Final Review`}
            </p>
            <p className="text-xs text-muted-foreground">
              {step === "SETUP" && "Set document title and agreement metadata first."}
              {step === "PARTY_A" && "Capture sender-side legal details."}
              {step === "PARTY_B" && "Capture recipient-side legal details."}
              {step === "TERMS" && "Adjust terms, clauses, and optional editable paragraphs."}
              {step === "REVIEW" && "Confirm the preview, then continue to signing field placement."}
            </p>
          </div>
          {step === "SETUP" ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="requestTitle">Request Title</Label>
                <Input
                  id="requestTitle"
                  value={requestTitle}
                  onChange={(event) => setRequestTitle(event.target.value)}
                  className="mt-1.5"
                />
              </div>
              {groupedVariables.setup.map((variable) => (
                <VariableInput
                  key={variable.key}
                  variable={variable}
                  value={values[variable.key] ?? ""}
                  onChange={(nextValue) => setValues((prev) => ({ ...prev, [variable.key]: nextValue }))}
                />
              ))}
            </div>
          ) : null}

          {step === "PARTY_A" ? (
            <div className="space-y-3">
              {groupedVariables.partyA.map((variable) => (
                <VariableInput
                  key={variable.key}
                  variable={variable}
                  value={values[variable.key] ?? ""}
                  onChange={(nextValue) => setValues((prev) => ({ ...prev, [variable.key]: nextValue }))}
                />
              ))}
            </div>
          ) : null}

          {step === "PARTY_B" ? (
            <div className="space-y-3">
              {groupedVariables.partyB.map((variable) => (
                <VariableInput
                  key={variable.key}
                  variable={variable}
                  value={values[variable.key] ?? ""}
                  onChange={(nextValue) => setValues((prev) => ({ ...prev, [variable.key]: nextValue }))}
                />
              ))}
            </div>
          ) : null}

          {step === "TERMS" ? (
            <div className="space-y-4">
              {groupedVariables.terms.map((variable) => (
                <VariableInput
                  key={variable.key}
                  variable={variable}
                  value={values[variable.key] ?? ""}
                  onChange={(nextValue) => setValues((prev) => ({ ...prev, [variable.key]: nextValue }))}
                />
              ))}
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
                  Rewrite editable paragraphs for this send only.
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
            </div>
          ) : null}

          {step === "REVIEW" ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
              <p className="text-sm font-semibold text-foreground">Ready to Continue</p>
              <p>
                Next step opens signing setup where you can position Sign, Initials, Date, and other fields before sending.
              </p>
              <p>
                Required values complete:{" "}
                <span className="font-medium text-foreground">
                  {schema.variables.filter((v) => v.required && (values[v.key] ?? "").trim()).length}/
                  {schema.variables.filter((v) => v.required).length}
                </span>
              </p>
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={goPrevStep}
              disabled={currentStepIndex <= 0 || submitting}
              className="flex-1"
            >
              Back
            </Button>
            {step !== "REVIEW" ? (
              <Button type="button" onClick={goNextStep} disabled={submitting} className="flex-1">
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={submitting} className="flex-1 gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue to Signing Setup"}
              </Button>
            )}
          </div>
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
                  {renderInterpolatedText(sourceText, values)}
                </p>
              );
            })}
          </div>
        </div>
      </form>
    </div>
  );
}

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: VariableDef;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={variable.key}>
        {variable.label}
        {variable.required ? <span className="text-red-600"> *</span> : null}
      </Label>
      {variable.type === "multiline" || variable.type === "address" ? (
        <textarea
          id={variable.key}
          value={value}
          required={variable.required}
          maxLength={variable.maxLength}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm resize-none min-h-[86px]"
        />
      ) : (
        <Input
          id={variable.key}
          type={variable.type === "email" ? "email" : variable.type === "number" ? "number" : "text"}
          value={value}
          required={variable.required}
          maxLength={variable.maxLength}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1.5"
        />
      )}
    </div>
  );
}
