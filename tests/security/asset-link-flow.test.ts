import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { assertAssetOwnership, selectAssetsForToken } from "@/lib/asset-library";

function dataUri(label: string) {
  return `data:image/png;base64,${Buffer.from(label).toString("base64")}`;
}

test("create secure link with assetIds stores and preserves selected order", async () => {
  const suffix = Date.now().toString(36);
  const user = await db.user.create({
    data: {
      email: `asset-secure-${suffix}@example.com`,
      passwordHash: "x",
      displayName: "Asset Secure",
      agentSlug: `asset-secure-${suffix}`,
    },
  });

  try {
    const assetA = await db.agentAsset.create({
      data: {
        userId: user.id,
        type: "LOGO",
        name: "A",
        url: dataUri("A"),
        mimeType: "image/png",
        sizeBytes: 1,
      },
    });
    const assetB = await db.agentAsset.create({
      data: {
        userId: user.id,
        type: "LOGO",
        name: "B",
        url: dataUri("B"),
        mimeType: "image/png",
        sizeBytes: 1,
      },
    });

    const link = await db.secureLink.create({
      data: {
        token: `tok-secure-${suffix}`,
        linkType: "SSN_ONLY",
        expiresAt: new Date(Date.now() + 60_000),
        agentId: user.id,
        assets: {
          create: [
            { assetId: assetB.id, order: 0 },
            { assetId: assetA.id, order: 1 },
          ],
        },
      },
      include: {
        assets: { orderBy: { order: "asc" }, include: { asset: true } },
      },
    });

    const logoUrls = link.assets
      .map((entry) => entry.asset.url)
      .filter((u): u is string => Boolean(u));

    assert.deepEqual(logoUrls, [assetB.url!, assetA.url!]);
  } finally {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});

test("create form link with assetIds stores and preserves selected order", async () => {
  const suffix = Date.now().toString(36);
  const user = await db.user.create({
    data: {
      email: `asset-form-${suffix}@example.com`,
      passwordHash: "x",
      displayName: "Asset Form",
      agentSlug: `asset-form-${suffix}`,
    },
  });

  try {
    const form = await db.form.create({
      data: {
        agentId: user.id,
        title: "Test Form",
      },
    });

    const asset1 = await db.agentAsset.create({
      data: {
        userId: user.id,
        type: "LOGO",
        name: "1",
        url: dataUri("1"),
        mimeType: "image/png",
        sizeBytes: 1,
      },
    });
    const asset2 = await db.agentAsset.create({
      data: {
        userId: user.id,
        type: "LOGO",
        name: "2",
        url: dataUri("2"),
        mimeType: "image/png",
        sizeBytes: 1,
      },
    });

    const formLink = await db.formLink.create({
      data: {
        formId: form.id,
        token: `tok-form-${suffix}`,
        expiresAt: new Date(Date.now() + 60_000),
        assets: {
          create: [
            { assetId: asset2.id, order: 0 },
            { assetId: asset1.id, order: 1 },
          ],
        },
      },
      include: {
        assets: { orderBy: { order: "asc" }, include: { asset: true } },
      },
    });

    const logoUrls = formLink.assets
      .map((entry) => entry.asset.url)
      .filter((u): u is string => Boolean(u));

    assert.deepEqual(logoUrls, [asset2.url!, asset1.url!]);
  } finally {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});

test("unauthorized assetIds are rejected by ownership enforcement", () => {
  assert.throws(() => {
    assertAssetOwnership(["owned-1"], ["owned-1", "not-owned"]);
  });
});

test("fallback logo list is used when no selected assets are attached", () => {
  const selected: Array<{ id: string }> = [];
  const fallback = [{ id: "fallback-a" }, { id: "fallback-b" }];

  const result = selectAssetsForToken(selected, fallback);
  assert.deepEqual(result.map((r) => r.id), ["fallback-a", "fallback-b"]);
});

