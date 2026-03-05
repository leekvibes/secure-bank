import test from "node:test";
import assert from "node:assert/strict";
import { isPastRetention, retentionDeleteAt } from "@/lib/cleanup";

test("cleanup helper marks records past retention", () => {
  const now = new Date("2026-03-05T00:00:00.000Z");
  assert.equal(isPastRetention(new Date("2026-03-04T23:59:59.000Z"), now), true);
  assert.equal(isPastRetention(new Date("2026-03-05T00:00:01.000Z"), now), false);
});

test("cleanup helper computes retention deleteAt with fallback", () => {
  const created = new Date("2026-03-01T00:00:00.000Z");
  assert.equal(
    retentionDeleteAt(created, 7).toISOString(),
    new Date("2026-03-08T00:00:00.000Z").toISOString()
  );
  assert.equal(
    retentionDeleteAt(created, -1, 30).toISOString(),
    new Date("2026-03-31T00:00:00.000Z").toISOString()
  );
});
