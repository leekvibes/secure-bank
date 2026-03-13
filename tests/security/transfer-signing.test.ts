import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// We need to set the env var before importing
process.env.TRANSFER_SIGNING_SECRET = "test-secret-32-bytes-padded-here";

import { signTransferAccess, verifyTransferAccess } from "../../src/lib/transfer-signing.js";

describe("transfer-signing", () => {
  const opts = { fileId: "file-abc", transferToken: "tok-xyz", action: "download" as const };

  it("roundtrip: sign then verify returns original data", () => {
    const token = signTransferAccess(opts);
    const payload = verifyTransferAccess(token);
    assert.ok(payload !== null);
    assert.equal(payload!.fileId, opts.fileId);
    assert.equal(payload!.transferToken, opts.transferToken);
    assert.equal(payload!.action, opts.action);
  });

  it("returns null for tampered payload", () => {
    const token = signTransferAccess(opts);
    const parts = token.split(".");
    const decoded = Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const tampered = JSON.parse(decoded);
    tampered.fileId = "evil-file";
    const newPayload = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const result = verifyTransferAccess(`${newPayload}.${parts[1]}`);
    assert.equal(result, null);
  });

  it("returns null for tampered signature", () => {
    const token = signTransferAccess(opts);
    const tampered = token.slice(0, -4) + "XXXX";
    assert.equal(verifyTransferAccess(tampered), null);
  });

  it("returns null for expired token", () => {
    const token = signTransferAccess(opts);
    const parts = token.split(".");
    const decoded = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    decoded.exp = Math.floor(Date.now() / 1000) - 1; // expired
    // Re-sign with same secret to get valid sig for expired payload
    const newPayloadJson = JSON.stringify(decoded);
    const newPayloadB64 = Buffer.from(newPayloadJson).toString("base64url");
    const sig = Buffer.from(
      createHmac("sha256", process.env.TRANSFER_SIGNING_SECRET!).update(newPayloadJson).digest("base64")
    ).toString("base64url");
    assert.equal(verifyTransferAccess(`${newPayloadB64}.${sig}`), null);
  });

  it("returns null for missing dot separator", () => {
    assert.equal(verifyTransferAccess("nodottoken"), null);
  });

  it("returns null for empty string", () => {
    assert.equal(verifyTransferAccess(""), null);
  });
});
