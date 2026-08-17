import { DESCRIPTION_MAX } from "@/lib/constants";

export function isCatalogId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
}

export function sanitizeDescription(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "";
  if (text.length > DESCRIPTION_MAX) return undefined;
  return text;
}

export function isVersion(value: string): boolean {
  return /^[A-Za-z0-9.+_-]{1,64}$/.test(value);
}

export function safeFilename(value: string): string {
  const name = value.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!name || name === "." || name === ".." || /[<>:"|?*\u0000-\u001f]/.test(name)) {
    return "";
  }
  return name;
}

export function isZipFilename(value: string): boolean {
  return safeFilename(value).toLowerCase().endsWith(".zip");
}

export function isImageFilename(value: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(safeFilename(value));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeImagePathname(
  pathname: string,
  modId: string,
): string | null {
  const cleaned = pathname.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..") || cleaned.startsWith("http")) {
    return null;
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length !== 5 || parts[0] !== "mods" || parts[2] !== "images") {
    return null;
  }
  const [, id, , imageId, filename] = parts;
  const safeName = safeFilename(filename);
  if (
    id !== modId ||
    !isCatalogId(id) ||
    !UUID.test(imageId) ||
    !safeName ||
    !isImageFilename(safeName)
  ) {
    return null;
  }
  return `mods/${id}/images/${imageId}/${safeName}`;
}

export function sanitizeQuarantinePathname(
  pathname: string,
  userId: string,
): string | null {
  const cleaned = pathname.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..") || cleaned.startsWith("http")) {
    return null;
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "quarantine") {
    return null;
  }
  const [, owner, uploadId, filename] = parts;
  if (owner !== userId || !/^[A-Za-z0-9_-]+$/.test(owner) || !UUID.test(uploadId) || !isZipFilename(filename)) {
    return null;
  }
  return `quarantine/${owner}/${uploadId}/${safeFilename(filename)}`;
}

export function sanitizePathname(pathname: string): string | null {
  const cleaned = pathname.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..") || cleaned.startsWith("http")) {
    return null;
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] === "mods" && parts.length === 4) {
    const [, id, version, filename] = parts;
    if (!isCatalogId(id) || !isVersion(version) || !safeFilename(filename)) {
      return null;
    }
    return `mods/${id}/${version}/${filename}`;
  }
  if (parts[0] === "app" && parts.length === 3) {
    const [, version, filename] = parts;
    if (!isVersion(version) || !safeFilename(filename)) {
      return null;
    }
    return `app/${version}/${filename}`;
  }
  return null;
}
