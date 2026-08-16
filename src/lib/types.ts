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

export type CatalogMod = {
  id: string;
  name: string;
  latestVersion: string;
  changelog?: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  publishedAt: string;
  versions: CatalogVersion[];
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

export function publicMod(mod: CatalogMod) {
  return {
    id: mod.id,
    name: mod.name,
    latestVersion: mod.latestVersion,
    changelog: mod.changelog ?? "",
    filename: mod.filename,
    sha256: mod.sha256,
    sizeBytes: mod.sizeBytes,
    downloadUrl: mod.downloadUrl,
    publishedAt: mod.publishedAt,
    versions: mod.versions,
  };
}
