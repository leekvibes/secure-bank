import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mimeCategory, isPreviewable, dispositionFor } from "../../src/lib/transfer-mime.js";

describe("transfer-mime", () => {
  it("image/jpeg → image category", () => assert.equal(mimeCategory("image/jpeg"), "image"));
  it("video/mp4 → video category", () => assert.equal(mimeCategory("video/mp4"), "video"));
  it("audio/mpeg → audio category", () => assert.equal(mimeCategory("audio/mpeg"), "audio"));
  it("application/pdf → pdf category", () => assert.equal(mimeCategory("application/pdf"), "pdf"));
  it("text/plain → text category", () => assert.equal(mimeCategory("text/plain"), "text"));
  it("application/zip → archive category", () => assert.equal(mimeCategory("application/zip"), "archive"));
  it("application/octet-stream → generic category", () => assert.equal(mimeCategory("application/octet-stream"), "generic"));

  it("image/png is previewable", () => assert.equal(isPreviewable("image/png"), true));
  it("video/webm is previewable", () => assert.equal(isPreviewable("video/webm"), true));
  it("application/zip is NOT previewable", () => assert.equal(isPreviewable("application/zip"), false));
  it("application/octet-stream is NOT previewable", () => assert.equal(isPreviewable("application/octet-stream"), false));

  it("download action always returns attachment", () => {
    assert.equal(dispositionFor("download", "image/jpeg"), "attachment");
    assert.equal(dispositionFor("download", "video/mp4"), "attachment");
    assert.equal(dispositionFor("download", "application/pdf"), "attachment");
  });

  it("preview of image returns inline", () => assert.equal(dispositionFor("preview", "image/jpeg"), "inline"));
  it("preview of video returns inline", () => assert.equal(dispositionFor("preview", "video/mp4"), "inline"));
  it("preview of unsupported returns attachment", () => assert.equal(dispositionFor("preview", "application/zip"), "attachment"));
});
