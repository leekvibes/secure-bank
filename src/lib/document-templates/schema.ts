import { z } from "zod";
import { format } from "date-fns";
import type {
  DocumentSigningDefault,
  DocumentTemplateSchema,
  DocumentVariableDef,
} from "@/lib/document-templates/types";

const variableDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "multiline", "address", "date_text", "currency_usd", "email", "phone", "number"]),
  required: z.boolean(),
  editable: z.boolean().default(true),
  maxLength: z.number().int().positive().max(5000).optional(),
});

const clauseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
  defaultEnabled: z.boolean().optional(),
});

const blockSchema = z.object({
  kind: z.enum(["heading", "paragraph", "spacer"]),
  text: z.string().optional(),
  size: z.number().int().min(0).max(80).optional(),
  clauseId: z.string().optional(),
});

const templateSchema = z.object({
  title: z.string().min(1),
  locale: z.string().optional(),
  versionLabel: z.string().optional(),
  roles: z.array(z.string().min(1)).min(1),
  variables: z.array(variableDefSchema),
  clauses: z.array(clauseSchema).optional(),
  blocks: z.array(blockSchema).min(1),
});

const signingDefaultSchema = z.object({
  type: z.enum([
    "SIGNATURE",
    "INITIALS",
    "DATE_SIGNED",
    "FULL_NAME",
    "TITLE",
    "COMPANY",
    "TEXT",
    "CHECKBOX",
    "RADIO",
    "DROPDOWN",
    "ATTACHMENT",
  ]),
  role: z.string().min(1),
  page: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1),
  height: z.number().min(0.01).max(1),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export function parseDocumentTemplateSchema(raw: string | null | undefined): DocumentTemplateSchema {
  if (!raw) throw new Error("Document schema is missing.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Document schema JSON is invalid.");
  }
  const result = templateSchema.safeParse(parsed);
  if (!result.success) throw new Error("Document schema validation failed.");
  return result.data as DocumentTemplateSchema;
}

export function parseSigningDefaults(raw: string | null | undefined): DocumentSigningDefault[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Signing defaults JSON is invalid.");
  }
  const result = z.array(signingDefaultSchema).safeParse(parsed);
  if (!result.success) throw new Error("Signing defaults validation failed.");
  return result.data as DocumentSigningDefault[];
}

export function parseDocDefaultValues(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function normalizeDocumentValues(
  schema: DocumentTemplateSchema,
  rawValues: Record<string, unknown>,
): { values: Record<string, string>; errors: string[] } {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  const allowed = new Set(schema.variables.map((v) => v.key));

  for (const key of Object.keys(rawValues)) {
    if (!allowed.has(key)) errors.push(`Unknown variable key: ${key}`);
  }

  for (const variable of schema.variables) {
    const normalized = normalizeValue(variable, rawValues[variable.key]);
    if (variable.required && !normalized) {
      errors.push(`${variable.label} is required.`);
      continue;
    }
    if (normalized) values[variable.key] = normalized;
  }

  return { values, errors };
}

export function resolveEnabledClauses(
  schema: DocumentTemplateSchema,
  inputClauseIds: string[] | undefined,
): { enabledClauseIds: string[]; errors: string[] } {
  const errors: string[] = [];
  const clauses = schema.clauses ?? [];
  const known = new Set(clauses.map((clause) => clause.id));
  const requested = new Set((inputClauseIds ?? []).filter(Boolean));

  for (const clauseId of Array.from(requested)) {
    if (!known.has(clauseId)) errors.push(`Unknown clause: ${clauseId}`);
  }

  for (const clause of clauses) {
    if (clause.required || clause.defaultEnabled) requested.add(clause.id);
  }

  return { enabledClauseIds: Array.from(requested), errors };
}

function normalizeValue(variable: DocumentVariableDef, input: unknown): string {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return "";

  if (variable.maxLength && text.length > variable.maxLength) {
    return text.slice(0, variable.maxLength);
  }

  switch (variable.type) {
    case "email":
      return z.string().email().safeParse(text).success ? text.toLowerCase() : "";
    case "phone": {
      const digits = text.replace(/[^\d]/g, "");
      if (digits.length < 10 || digits.length > 15) return "";
      if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      return `+${digits}`;
    }
    case "currency_usd": {
      const num = Number(text.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(num)) return "";
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
    }
    case "number": {
      const num = Number(text.replace(/,/g, ""));
      return Number.isFinite(num) ? String(num) : "";
    }
    case "date_text": {
      const d = new Date(text);
      if (Number.isNaN(d.getTime())) return "";
      return format(d, "MMMM d, yyyy");
    }
    case "multiline":
    case "address":
    case "text":
    default:
      return text;
  }
}
