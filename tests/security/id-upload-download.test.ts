import test from "node:test";
import assert from "node:assert/strict";
import { getIdUploadAccessResult } from "@/lib/id-upload-access";

test("id upload download ownership protection returns forbidden for non-owner", () => {
  const result = getIdUploadAccessResult("agent_owner", "agent_other");
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.status, 403);
    assert.equal(result.message, "Forbidden.");
  }
});
