import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAssetOwnership,
  isAssetOwnedByUser,
  selectAssetsForToken,
} from "@/lib/asset-library";
import { validateUploadFile } from "@/lib/upload-security";

test("agent can only access/delete their own assets", () => {
  assert.equal(isAssetOwnedByUser("user_a", "user_a"), true);
  assert.equal(isAssetOwnedByUser("user_a", "user_b"), false);
});

test("attaching assets to a link enforces ownership", () => {
  assert.doesNotThrow(() => {
    assertAssetOwnership(["a1", "a2"], ["a1"]);
  });

  assert.throws(() => {
    assertAssetOwnership(["a1"], ["a1", "a2"]);
  });
});

test("token config selection returns only selected assets when present", () => {
  const selected = [{ id: "sel_1" }, { id: "sel_2" }];
  const fallback = [{ id: "fallback_1" }];

  const useSelected = selectAssetsForToken(selected, fallback);
  assert.equal(useSelected.length, 2);
  assert.equal(useSelected[0].id, "sel_1");

  const useFallback = selectAssetsForToken([], fallback);
  assert.equal(useFallback.length, 1);
  assert.equal(useFallback[0].id, "fallback_1");
});

test("upload validation rejects invalid mime and oversize files", () => {
  const invalidMime = new File(["hello"], "note.txt", { type: "text/plain" });
  const invalidMimeResult = validateUploadFile(invalidMime);
  assert.equal(invalidMimeResult.ok, false);

  const oversized = new File([Buffer.alloc(10 * 1024 * 1024 + 1)], "big.jpg", {
    type: "image/jpeg",
  });
  const oversizedResult = validateUploadFile(oversized);
  assert.equal(oversizedResult.ok, false);
});

test("upload validation accepts webp images", () => {
  const webp = new File(["webp"], "photo.webp", { type: "image/webp" });
  const result = validateUploadFile(webp);
  assert.equal(result.ok, true);
});
