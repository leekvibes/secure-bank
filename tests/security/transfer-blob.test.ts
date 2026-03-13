import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedTransferBlobUrl } from "../../src/lib/transfer-blob.js";

describe("transfer-blob", () => {
  it("allows vercel blob hosts over https", () => {
    assert.equal(
      isAllowedTransferBlobUrl("https://abc123.public.blob.vercel-storage.com/file.pdf"),
      true
    );
    assert.equal(
      isAllowedTransferBlobUrl("https://x.y.vercel-storage.com/folder/file.png"),
      true
    );
  });

  it("rejects non-https and non-vercel-storage hosts", () => {
    assert.equal(
      isAllowedTransferBlobUrl("http://abc123.public.blob.vercel-storage.com/file.pdf"),
      false
    );
    assert.equal(
      isAllowedTransferBlobUrl("https://evil.example.com/file.pdf"),
      false
    );
    assert.equal(
      isAllowedTransferBlobUrl("not-a-url"),
      false
    );
  });
});

