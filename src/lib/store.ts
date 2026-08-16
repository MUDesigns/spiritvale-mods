import { list, put } from "@vercel/blob";
import { emptyCatalog, type Catalog } from "./types";

const CATALOG_PATH = "catalog.json";

export async function loadCatalog(): Promise<Catalog> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return emptyCatalog();
  }

  const { blobs } = await list({ prefix: CATALOG_PATH, limit: 20 });
  const hit = blobs.find((blob) => blob.pathname === CATALOG_PATH);
  if (!hit) {
    return emptyCatalog();
  }

  const response = await fetch(hit.url, { cache: "no-store" });
  if (!response.ok) {
    return emptyCatalog();
  }
  const data = (await response.json()) as Catalog;
  return {
    mods: data.mods ?? {},
    app: data.app ?? null,
  };
}

export async function saveCatalog(catalog: Catalog): Promise<void> {
  await put(CATALOG_PATH, JSON.stringify(catalog, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}
