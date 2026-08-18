import { copy, del, get, list, put } from "@vercel/blob";
import { emptyCatalog, type Catalog } from "./types";

const CATALOG_PATH = "catalog.json";

export async function loadCatalogFromBlob(): Promise<Catalog> {
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
    cacheControlMaxAge: 0,
  });
}

export async function deleteStoredBlob(pathname: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !pathname) return;
  try {
    await del(pathname);
  } catch {
    // Blob may already be gone (quarantine copy cleaned after scan).
  }
}

export async function publishModZip(sourcePath: string, publicPath: string) {
  return copy(sourcePath, publicPath, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/zip",
  });
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function blobAccessFromUrl(url: string): "public" | "private" {
  return url.includes(".private.blob.vercel-storage.com") ? "private" : "public";
}

export async function readStoredBlob(
  pathname: string,
  downloadUrl?: string | null,
): Promise<Buffer> {
  const attempts: Array<{ urlOrPath: string; access: "public" | "private" }> = [];
  if (downloadUrl?.startsWith("http")) {
    attempts.push({ urlOrPath: downloadUrl, access: blobAccessFromUrl(downloadUrl) });
  }
  attempts.push({ urlOrPath: pathname, access: "public" });
  attempts.push({ urlOrPath: pathname, access: "private" });

  const seen = new Set<string>();
  let lastError: unknown;
  for (const attempt of attempts) {
    const key = `${attempt.access}:${attempt.urlOrPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      if (attempt.access === "public" && attempt.urlOrPath.startsWith("http")) {
        const response = await fetch(attempt.urlOrPath);
        if (response.ok) {
          return Buffer.from(await response.arrayBuffer());
        }
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        continue;
      }
      const result = await get(attempt.urlOrPath, {
        access: attempt.access,
        ...(attempt.access === "private" ? { useCache: false } : {}),
      });
      if (!result?.stream) {
        lastError = new Error("Quarantine blob was not found.");
        continue;
      }
      return await streamToBuffer(result.stream);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Quarantine blob was not found.");
}
