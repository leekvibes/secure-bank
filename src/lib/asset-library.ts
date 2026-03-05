import { db } from "@/lib/db";
import { deleteFile, encryptAndSaveFile, readAndDecryptFile } from "@/lib/files";
import { validateUploadFile } from "@/lib/upload-security";

export const ASSET_TYPES = ["LOGO", "AVATAR", "BANNER"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

function isAssetType(value: string): value is AssetType {
  return ASSET_TYPES.includes(value as AssetType);
}

function parseDataUri(dataUri: string): { mimeType: string; sizeBytes: number } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  const [, mimeType, b64] = match;
  const sizeBytes = Buffer.from(b64, "base64").length;
  return { mimeType, sizeBytes };
}

function requiresImage(type: AssetType): boolean {
  return type === "LOGO" || type === "AVATAR";
}

function isImageMime(mimeType: string): boolean {
  return ["image/jpeg", "image/png"].includes(mimeType);
}

export function assertAssetOwnership(
  ownedAssetIds: string[],
  requestedAssetIds: string[]
): void {
  const owned = new Set(ownedAssetIds);
  for (const id of requestedAssetIds) {
    if (!owned.has(id)) {
      throw new Error("One or more assets are not owned by this user.");
    }
  }
}

export function isAssetOwnedByUser(
  assetUserId: string,
  requesterUserId: string
): boolean {
  return assetUserId === requesterUserId;
}

export function selectAssetsForToken<T>(
  selectedAssets: T[],
  fallbackAssets: T[]
): T[] {
  return selectedAssets.length > 0 ? selectedAssets : fallbackAssets;
}

export async function ensureLegacyLogoAsset(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { logoUrl: true },
  });

  if (!user?.logoUrl) return;

  const existing = await db.agentAsset.findFirst({
    where: { userId, type: "LOGO", url: user.logoUrl },
    select: { id: true },
  });
  if (existing) return;

  const parsed = parseDataUri(user.logoUrl);
  if (!parsed) return;

  await db.agentAsset.create({
    data: {
      userId,
      type: "LOGO",
      name: "Legacy logo",
      url: user.logoUrl,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
    },
  });
}

export async function createAssetFromUpload(opts: {
  userId: string;
  file: File;
  type: string;
  name?: string;
}) {
  const normalizedType: AssetType = isAssetType(opts.type) ? opts.type : "LOGO";
  const validation = validateUploadFile(opts.file);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid file.");
  }

  if (requiresImage(normalizedType) && !isImageMime(opts.file.type)) {
    throw new Error("LOGO/AVATAR assets must be JPG or PNG images.");
  }

  const bytes = Buffer.from(await opts.file.arrayBuffer());
  const fileKey = await encryptAndSaveFile(bytes);

  return db.agentAsset.create({
    data: {
      userId: opts.userId,
      type: normalizedType,
      name: opts.name?.trim() || null,
      fileKey,
      mimeType: opts.file.type,
      sizeBytes: opts.file.size,
    },
  });
}

export async function deleteAssetFileIfAny(asset: {
  fileKey: string | null;
}): Promise<void> {
  if (!asset.fileKey) return;
  await deleteFile(asset.fileKey);
}

export async function toAssetRenderEntry(asset: {
  id: string;
  type: string;
  name: string | null;
  mimeType: string;
  sizeBytes: number;
  fileKey: string | null;
  url: string | null;
}) {
  let sourceUrl: string | null = asset.url ?? null;

  if (!sourceUrl && asset.fileKey) {
    const data = await readAndDecryptFile(asset.fileKey);
    sourceUrl = `data:${asset.mimeType};base64,${data.toString("base64")}`;
  }

  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    url: sourceUrl,
  };
}
