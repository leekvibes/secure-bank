import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditLogData } from "@/lib/audit";

test("audit event payload creation excludes sensitive body data and truncates user agent", () => {
  const originalAuditStoreIp = process.env.AUDIT_STORE_IP;
  process.env.AUDIT_STORE_IP = "true";

  const request = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 203.0.113.11",
      "user-agent": "a".repeat(250),
    },
  });

  const payload = buildAuditLogData({
    event: "SUBMITTED",
    agentId: "agent_1",
    linkId: "link_1",
    request,
    metadata: { action: "submit" },
  });

  assert.equal(payload.event, "SUBMITTED");
  assert.equal(payload.agentId, "agent_1");
  assert.equal(payload.linkId, "link_1");
  assert.equal(payload.ipAddress, "203.0.113.10");
  assert.equal(payload.userAgent?.length, 200);
  assert.equal(payload.metadata, JSON.stringify({ action: "submit" }));

  process.env.AUDIT_STORE_IP = originalAuditStoreIp;
});

