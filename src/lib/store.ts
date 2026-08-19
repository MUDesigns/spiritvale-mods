import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";
import { SITE_URL } from "@/lib/constants";
import { sanitizePublicFilePath, sanitizeStoredPathname } from "@/lib/ids";
import { emptyCatalog, type Catalog } from "./types";

const CATALOG_PATH = "catalog.json";

export type StoredFile = {
  pathname: string;
  url: string;
  downloadUrl: string;
  sizeBytes: number;
};

export function storageRoot(): string {
  return process.env.STORAGE_DIR?.trim() || path.join(process.cwd(), "data", "storage");
}

export function publicFileUrl(pathname: string): string {
  const encoded = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${SITE_URL.replace(/\/$/, "")}/files/${encoded}`;
}

export function absoluteStoragePath(pathname: string): string {
  const safe = sanitizeStoredPathname(pathname);
  if (!safe) {
    throw new Error("Invalid storage path.");
  }
  return path.join(storageRoot(), ...safe.split("/"));
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function putStoredFile(
  pathname: string,
  body: Buffer | Uint8Array | string,
): Promise<StoredFile> {
  const safe = sanitizeStoredPathname(pathname);
  if (!safe) throw new Error("Invalid storage path.");
  const dest = path.join(storageRoot(), ...safe.split("/"));
  await ensureParent(dest);
  const bytes = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
  await writeFile(dest, bytes);
  return {
    pathname: safe,
    url: publicFileUrl(safe),
    downloadUrl: publicFileUrl(safe),
    sizeBytes: bytes.length,
  };
}

export async function writeStoredStream(
  pathname: string,
  stream: AsyncIterable<Buffer | Uint8Array>,
  maxBytes: number,
): Promise<StoredFile> {
  const safe = sanitizeStoredPathname(pathname);
  if (!safe) throw new Error("Invalid storage path.");
  const dest = path.join(storageRoot(), ...safe.split("/"));
  await ensureParent(dest);
  const temp = `${dest}.${process.pid}.${Date.now()}.part`;
  const out = createWriteStream(temp);
  let sizeBytes = 0;
  try {
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += buf.length;
      if (sizeBytes > maxBytes) {
        throw new Error(`Upload exceeds ${maxBytes} bytes.`);
      }
      if (!out.write(buf)) {
        await once(out, "drain");
      }
    }
    await new Promise<void>((resolve, reject) => {
      out.end((error: NodeJS.ErrnoException | null) => (error ? reject(error) : resolve()));
    });
    if (sizeBytes === 0) {
      throw new Error("Empty upload body.");
    }
    await rename(temp, dest);
  } catch (error) {
    out.destroy();
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
  return {
    pathname: safe,
    url: publicFileUrl(safe),
    downloadUrl: publicFileUrl(safe),
    sizeBytes,
  };
}

export async function loadCatalogFromBlob(): Promise<Catalog> {
  try {
    const dest = absoluteStoragePath(CATALOG_PATH);
    const raw = await readFile(dest, "utf8");
    const data = JSON.parse(raw) as Catalog;
    return {
      mods: data.mods ?? {},
      app: data.app ?? null,
    };
  } catch {
    return emptyCatalog();
  }
}

export async function saveCatalog(catalog: Catalog): Promise<void> {
  await putStoredFile(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

export async function deleteStoredBlob(pathname: string): Promise<void> {
  if (!pathname) return;
  try {
    await rm(absoluteStoragePath(pathname), { force: true });
  } catch {
    // File may already be gone.
  }
}

export async function publishModZip(sourcePath: string, publicPath: string): Promise<StoredFile> {
  const from = absoluteStoragePath(sourcePath);
  const to = absoluteStoragePath(publicPath);
  await ensureParent(to);
  await pipeline(createReadStream(from), createWriteStream(to));
  const info = await stat(to);
  const safe = sanitizeStoredPathname(publicPath)!;
  return {
    pathname: safe,
    url: publicFileUrl(safe),
    downloadUrl: publicFileUrl(safe),
    sizeBytes: info.size,
  };
}

export async function readStoredBlob(
  pathname: string,
  downloadUrl?: string | null,
): Promise<Buffer> {
  try {
    return await readFile(absoluteStoragePath(pathname));
  } catch {
    if (downloadUrl?.startsWith("http")) {
      const response = await fetch(downloadUrl);
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    }
    throw new Error("Stored file was not found.");
  }
}

export function contentTypeFor(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".exe")) return "application/octet-stream";
  return "application/octet-stream";
}

export function isPublicStoragePath(pathname: string): boolean {
  return Boolean(sanitizePublicFilePath(pathname));
}

export function publicDiskPath(pathname: string): string | null {
  const safe = sanitizePublicFilePath(pathname);
  if (!safe) return null;
  return path.join(storageRoot(), ...safe.split("/"));
}
