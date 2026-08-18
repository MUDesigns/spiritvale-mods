import { trackedModDownloadUrl } from "@/lib/downloads";

export type CatalogArtifact = {
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
};

export type CatalogVersion = CatalogArtifact & {
  version: string;
  changelog?: string;
  publishedAt: string;
};

export type CatalogModImage = {
  id: string;
  url: string;
  filename: string;
};

export type ModImageList = {
  thumbnailImageId: string | null;
  images: CatalogModImage[];
};

export type CatalogMod = {
  id: string;
  name: string;
  description?: string;
  latestVersion: string;
  changelog?: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  publishedAt: string;
  downloadCount?: number;
  thumbnailUrl?: string;
  images?: CatalogModImage[];
  versions: CatalogVersion[];
};

export type PublicModSummary = {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  changelog: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  publishedAt: string;
  downloadCount: number;
  thumbnailUrl?: string;
};

export type CatalogSort = "name" | "newest" | "oldest" | "size" | "downloads";

export type PublicModPage = {
  mods: PublicModSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AppRelease = {
  version: string;
  changelog?: string;
  publishedAt: string;
  installer?: CatalogArtifact;
  portable?: CatalogArtifact;
};

export type Catalog = {
  mods: Record<string, CatalogMod>;
  app: AppRelease | null;
};

export function emptyCatalog(): Catalog {
  return { mods: {}, app: null };
}

export function publicModSummary(mod: Pick<CatalogMod, keyof PublicModSummary>): PublicModSummary {
  return {
    id: mod.id,
    name: mod.name,
    description: mod.description ?? "",
    latestVersion: mod.latestVersion,
    changelog: mod.changelog ?? "",
    filename: mod.filename,
    sha256: mod.sha256,
    sizeBytes: mod.sizeBytes,
    downloadUrl: trackedModDownloadUrl(mod.id),
    publishedAt: mod.publishedAt,
    downloadCount: mod.downloadCount ?? 0,
    thumbnailUrl: mod.thumbnailUrl,
  };
}

export function publicMod(mod: CatalogMod) {
  return {
    ...publicModSummary(mod),
    versions: mod.versions.map((entry) => ({
      ...entry,
      downloadUrl: trackedModDownloadUrl(mod.id, entry.version),
    })),
    images: mod.images ?? [],
  };
}
