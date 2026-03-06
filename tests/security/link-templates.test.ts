import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { createLinkTemplate, listLinkTemplates, updateLinkTemplate, deleteLinkTemplate, applyTemplateDefaults } from "@/lib/link-templates";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("template CRUD enforces ownership", async () => {
  const owner = await db.user.create({
    data: {
      email: uniqueEmail("tmpl-owner"),
      passwordHash: "hash",
      displayName: "Owner",
      agentSlug: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });
  const other = await db.user.create({
    data: {
      email: uniqueEmail("tmpl-other"),
      passwordHash: "hash",
      displayName: "Other",
      agentSlug: `other-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });

  const template = await createLinkTemplate(owner.id, {
    name: "Carrier A Template",
    linkType: "BANKING_INFO",
    destinationLabel: "Mutual of Omaha",
    expiresIn: 24,
    messageTemplate: "Hello\nPlease complete this.",
    options: { effectiveDateEnabled: true },
    assetIds: [],
  });

  const otherList = await listLinkTemplates(other.id);
  assert.equal(otherList.length, 0);

  const deniedUpdate = await updateLinkTemplate(other.id, template.id, { name: "Nope" });
  assert.equal(deniedUpdate, null);

  const deniedDelete = await deleteLinkTemplate(other.id, template.id);
  assert.equal(deniedDelete, false);

  const ownerDelete = await deleteLinkTemplate(owner.id, template.id);
  assert.equal(ownerDelete, true);
});

test("template asset order is preserved and link create payload persists template fields", async () => {
  const user = await db.user.create({
    data: {
      email: uniqueEmail("tmpl-assets"),
      passwordHash: "hash",
      displayName: "Template Assets",
      agentSlug: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });

  const a1 = await db.agentAsset.create({
    data: {
      userId: user.id,
      type: "LOGO",
      name: "First",
      mimeType: "image/png",
      sizeBytes: 111,
      url: "data:image/png;base64,AA==",
    },
  });
  const a2 = await db.agentAsset.create({
    data: {
      userId: user.id,
      type: "LOGO",
      name: "Second",
      mimeType: "image/png",
      sizeBytes: 222,
      url: "data:image/png;base64,BB==",
    },
  });

  const template = await createLinkTemplate(user.id, {
    name: "Ordered Assets Template",
    linkType: "SSN_ONLY",
    destinationLabel: "Americo",
    expiresIn: 48,
    messageTemplate: "Template message body",
    options: { middleInitialToggle: true },
    assetIds: [a2.id, a1.id],
  });

  const listed = await listLinkTemplates(user.id);
  const listedTemplate = listed.find((t) => t.id === template.id);
  assert.ok(listedTemplate);
  assert.deepEqual(listedTemplate?.assetIds, [a2.id, a1.id]);

  const fullTemplate = await db.linkTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: { assets: { orderBy: { order: "asc" }, select: { assetId: true, order: true } } },
  });

  const resolved = applyTemplateDefaults(fullTemplate, {
    clientName: "Client X",
    clientPhone: "+1 555 000 1234",
    clientEmail: "client@example.com",
    retentionDays: 7,
  });

  const token = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const link = await db.secureLink.create({
    data: {
      token,
      linkType: resolved.linkType,
      destination: resolved.destinationLabel ?? null,
      destinationLabel: resolved.destinationLabel ?? null,
      messageTemplate: (resolved.message as string | undefined) ?? null,
      optionsJson: resolved.options ? JSON.stringify(resolved.options) : null,
      clientName: (resolved.clientName as string) ?? null,
      clientPhone: (resolved.clientPhone as string) ?? null,
      clientEmail: (resolved.clientEmail as string) ?? null,
      expiresAt: new Date(Date.now() + Number(resolved.expirationHours) * 60 * 60 * 1000),
      retentionDays: Number(resolved.retentionDays),
      agentId: user.id,
      assets: {
        create: (resolved.assetIds as string[]).map((assetId, order) => ({ assetId, order })),
      },
    },
    include: { assets: { orderBy: { order: "asc" } } },
  });

  assert.equal(link.destinationLabel, "Americo");
  assert.equal(link.messageTemplate, "Template message body");
  assert.deepEqual(JSON.parse(link.optionsJson ?? "{}"), { middleInitialToggle: true });
  assert.deepEqual(link.assets.map((a) => a.assetId), [a2.id, a1.id]);
});
