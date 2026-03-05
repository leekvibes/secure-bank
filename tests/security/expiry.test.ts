import test from "node:test";
import assert from "node:assert/strict";
import { isExpired } from "@/lib/utils";
import { isValidSingleUseToken } from "@/lib/validation";

test("token expiry enforcement helper", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();

  assert.equal(isExpired(past), true);
  assert.equal(isExpired(future), false);
});

test("single-use token enforcement helper", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const expired = new Date(Date.now() - 60_000).toISOString();

  assert.deepEqual(
    isValidSingleUseToken(expired, "CREATED", false),
    { ok: false, code: "expired", message: "This link has expired." }
  );
  assert.deepEqual(
    isValidSingleUseToken(future, "SUBMITTED", false),
    { ok: false, code: "already_used", message: "This link has already been submitted." }
  );
  assert.deepEqual(
    isValidSingleUseToken(future, "OPENED", true),
    { ok: false, code: "already_used", message: "This link has already been submitted." }
  );
  assert.deepEqual(isValidSingleUseToken(future, "OPENED", false), { ok: true });
});
