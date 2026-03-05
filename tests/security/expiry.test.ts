import test from "node:test";
import assert from "node:assert/strict";
import { isExpired } from "@/lib/utils";

test("token expiry enforcement helper", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();

  assert.equal(isExpired(past), true);
  assert.equal(isExpired(future), false);
});

