import { db } from "@/lib/db";
import { assertAssetOwnership } from "@/lib/asset-library";
import type { LinkTemplateInput, UpdateLinkTemplateInput } from "@/lib/schemas";

export async function listLinkTemplates(userId: string) {
  const templates = await db.linkTemplate.findMany({
    where: { userId },
    include: {
      assets: {
        orderBy: { order: "asc" },
        include: { asset: { select: { id: true, type: true, name: true, url: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    linkType: template.linkType,
    destinationLabel: template.destinationLabel,
    expiresIn: template.expiresIn,
    messageTemplate: template.messageTemplate,
    options: template.optionsJson ? JSON.parse(template.optionsJson) : {},
    assetIds: template.assets.map((item) => item.assetId),
    assets: template.assets.map((item) => item.asset),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }));
}

async function ensureOwnedAssets(userId: string, assetIds: string[]) {
  if (assetIds.length === 0) return;
  const owned = await db.agentAsset.findMany({
    where: { userId, id: { in: assetIds } },
    select: { id: true },
  });
  assertAssetOwnership(owned.map((asset) => asset.id), assetIds);
}

export async function createLinkTemplate(userId: string, input: LinkTemplateInput) {
  const uniqueAssetIds = Array.from(new Set(input.assetIds ?? []));
  await ensureOwnedAssets(userId, uniqueAssetIds);

  const template = await db.linkTemplate.create({
    data: {
      userId,
      name: input.name.trim(),
      linkType: input.linkType,
      destinationLabel: input.destinationLabel?.trim() || null,
      expiresIn: input.expiresIn,
      messageTemplate: input.messageTemplate?.trim() || null,
      optionsJson: input.options ? JSON.stringify(input.options) : null,
      assets: uniqueAssetIds.length
        ? {
            create: uniqueAssetIds.map((assetId, order) => ({ assetId, order })),
          }
        : undefined,
    },
  });

  return template;
}

export async function updateLinkTemplate(
  userId: string,
  templateId: string,
  input: UpdateLinkTemplateInput
) {
  const existing = await db.linkTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  const assetIds = input.assetIds ? Array.from(new Set(input.assetIds)) : null;
  if (assetIds) {
    await ensureOwnedAssets(userId, assetIds);
  }

  return db.$transaction(async (tx) => {
    if (assetIds) {
      await tx.linkTemplateAsset.deleteMany({ where: { templateId } });
      if (assetIds.length > 0) {
        await tx.linkTemplateAsset.createMany({
          data: assetIds.map((assetId, order) => ({ templateId, assetId, order })),
        });
      }
    }

    const updated = await tx.linkTemplate.update({
      where: { id: templateId },
      data: {
        name: input.name?.trim(),
        linkType: input.linkType,
        destinationLabel:
          input.destinationLabel === undefined
            ? undefined
            : input.destinationLabel?.trim() || null,
        expiresIn: input.expiresIn,
        messageTemplate:
          input.messageTemplate === undefined
            ? undefined
            : input.messageTemplate?.trim() || null,
        optionsJson:
          input.options === undefined
            ? undefined
            : input.options
            ? JSON.stringify(input.options)
            : null,
      },
    });
    return updated;
  });
}

export async function deleteLinkTemplate(userId: string, templateId: string) {
  const existing = await db.linkTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!existing) return false;
  await db.linkTemplate.delete({ where: { id: templateId } });
  return true;
}

export function applyTemplateDefaults<T extends Record<string, unknown>>(
  template: {
    linkType: string;
    destinationLabel: string | null;
    expiresIn: number;
    messageTemplate: string | null;
    optionsJson: string | null;
    assets: { assetId: string; order: number }[];
  },
  input: T
) {
  const options =
    input.options !== undefined
      ? input.options
      : template.optionsJson
      ? JSON.parse(template.optionsJson)
      : undefined;

  const assetIds = Array.isArray(input.assetIds)
    ? (input.assetIds as string[])
    : template.assets.sort((a, b) => a.order - b.order).map((a) => a.assetId);

  return {
    ...input,
    linkType: (input.linkType as string | undefined) ?? template.linkType,
    destinationLabel:
      (input.destinationLabel as string | undefined) ??
      (input.destination as string | undefined) ??
      template.destinationLabel ??
      undefined,
    expirationHours:
      (input.expirationHours as number | undefined) ?? template.expiresIn,
    message:
      (input.message as string | undefined) ??
      template.messageTemplate ??
      undefined,
    options,
    assetIds,
  };
}
