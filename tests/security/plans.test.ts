import test from "node:test";
import assert from "node:assert/strict";
import { PLANS, hasPlanFeature, validatePlanMatrix } from "@/lib/plans";

test("plan matrix is internally consistent and monotonic", () => {
  const issues = validatePlanMatrix();
  assert.deepEqual(issues, []);
});

test("free and beginner do not include paid-only features", () => {
  assert.equal(hasPlanFeature("FREE", "FORMS"), false);
  assert.equal(hasPlanFeature("FREE", "TRANSFERS"), false);
  assert.equal(hasPlanFeature("BEGINNER", "FORMS"), false);
  assert.equal(hasPlanFeature("BEGINNER", "TRANSFERS"), false);
});

test("pro and agency include paid-only features", () => {
  assert.equal(hasPlanFeature("PRO", "FORMS"), true);
  assert.equal(hasPlanFeature("PRO", "TRANSFERS"), true);
  assert.equal(hasPlanFeature("AGENCY", "FORMS"), true);
  assert.equal(hasPlanFeature("AGENCY", "TRANSFERS"), true);
});

test("all configured plans include secure links", () => {
  for (const config of Object.values(PLANS)) {
    assert.equal(config.features.includes("SECURE_LINKS"), true);
  }
});

test("document templates are enabled only when signing is enabled", () => {
  for (const config of Object.values(PLANS)) {
    if (config.canUseDocumentTemplates) {
      assert.equal(config.canUseSigning, true);
    }
  }
});
