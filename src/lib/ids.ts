export function isCatalogId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
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
