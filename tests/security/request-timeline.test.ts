import test from "node:test";
import assert from "node:assert/strict";
import { buildRequestTimeline } from "@/lib/request-timeline";

test("request timeline merges audit and sends, skips LINK_SENT, and sorts chronologically", () => {
  const timeline = buildRequestTimeline(
    [
      { id: "a1", event: "LINK_CREATED", createdAt: new Date("2026-03-06T10:00:00.000Z") },
      { id: "a2", event: "LINK_SENT", createdAt: new Date("2026-03-06T10:05:00.000Z") },
      { id: "a3", event: "SUBMITTED", createdAt: new Date("2026-03-06T10:20:00.000Z") },
    ],
    [
      {
        id: "s1",
        method: "SMS",
        recipient: "+15550000000",
        createdAt: new Date("2026-03-06T10:10:00.000Z"),
      },
      {
        id: "s2",
        method: "COPY",
        recipient: "clipboard",
        createdAt: new Date("2026-03-06T10:15:00.000Z"),
      },
    ]
  );

  assert.equal(timeline.length, 4);
  assert.deepEqual(
    timeline.map((item) => item.label),
    ["Request created", "Sent via SMS", "Sent via link copy", "Form submitted"]
  );
  assert.equal(timeline[1]?.sublabel, "To: +15550000000");
  assert.equal(timeline[2]?.sublabel, undefined);
});
