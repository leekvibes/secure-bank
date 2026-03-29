import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDocumentValues,
  parseDocumentTemplateSchema,
  resolveEnabledClauses,
} from "@/lib/document-templates/schema";
import { renderDocumentTemplatePdf } from "@/lib/document-templates/render";

const RAW_SCHEMA = JSON.stringify({
  title: "Bill of Sale",
  roles: ["SELLER", "BUYER"],
  variables: [
    { key: "effective_date", label: "Effective Date", type: "date_text", required: true, editable: true },
    { key: "seller_name", label: "Seller Name", type: "text", required: true, editable: true },
    { key: "buyer_email", label: "Buyer Email", type: "email", required: false, editable: true },
    { key: "price", label: "Price", type: "currency_usd", required: false, editable: true },
  ],
  clauses: [{ id: "as_is", label: "As-Is", defaultEnabled: true }],
  blocks: [
    { kind: "heading", text: "Bill of Sale" },
    { kind: "paragraph", text: "Effective {{effective_date}}" },
    { kind: "paragraph", text: "Seller {{seller_name}}" },
    { kind: "paragraph", clauseId: "as_is", text: "As-is clause text." },
  ],
});

test("document schema parser accepts valid schema", () => {
  const schema = parseDocumentTemplateSchema(RAW_SCHEMA);
  assert.equal(schema.title, "Bill of Sale");
  assert.equal(schema.variables.length, 4);
});

test("normalizeDocumentValues enforces required and type constraints", () => {
  const schema = parseDocumentTemplateSchema(RAW_SCHEMA);
  const { values, errors } = normalizeDocumentValues(schema, {
    effective_date: "2026-03-29",
    seller_name: "Acme Seller LLC",
    buyer_email: "bad-email",
    price: "2500",
  });

  assert.equal(errors.length, 0);
  assert.equal(values.seller_name, "Acme Seller LLC");
  assert.equal(values.buyer_email, undefined);
  assert.equal(values.price, "$2,500.00");
  assert.match(values.effective_date, /2026/);
});

test("normalizeDocumentValues reports missing required fields", () => {
  const schema = parseDocumentTemplateSchema(RAW_SCHEMA);
  const { errors } = normalizeDocumentValues(schema, {
    effective_date: "",
    seller_name: "",
  });
  assert.ok(errors.some((e) => e.includes("Effective Date")));
  assert.ok(errors.some((e) => e.includes("Seller Name")));
});

test("resolveEnabledClauses includes defaults and validates unknown clauses", () => {
  const schema = parseDocumentTemplateSchema(RAW_SCHEMA);
  const resolved = resolveEnabledClauses(schema, ["as_is", "unknown_clause"]);
  assert.ok(resolved.enabledClauseIds.includes("as_is"));
  assert.ok(resolved.errors.some((e) => e.includes("unknown_clause")));
});

test("document renderer returns PDF bytes", async () => {
  const schema = parseDocumentTemplateSchema(RAW_SCHEMA);
  const { values } = normalizeDocumentValues(schema, {
    effective_date: "2026-03-29",
    seller_name: "Acme Seller LLC",
    price: "1234.56",
  });
  const clauseResolution = resolveEnabledClauses(schema, []);
  const pdfBuffer = await renderDocumentTemplatePdf(schema, values, clauseResolution.enabledClauseIds);
  assert.ok(pdfBuffer.byteLength > 100);
  assert.equal(pdfBuffer.toString("ascii", 0, 4), "%PDF");
});

