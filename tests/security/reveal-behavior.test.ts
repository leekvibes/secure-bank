import test from "node:test";
import assert from "node:assert/strict";
import { isRevealBlocked } from "@/lib/submission-security";

test("submission reveal behavior enforces view-once", () => {
  assert.equal(isRevealBlocked(true, new Date()), true);
  assert.equal(isRevealBlocked(true, null), false);
  assert.equal(isRevealBlocked(false, new Date()), false);
});

