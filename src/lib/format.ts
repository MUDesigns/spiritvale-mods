export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value)));
}

export function formatDownloads(value: number): string {
  const count = Math.max(0, Math.round(value));
  return `${formatCount(count)} ${count === 1 ? "download" : "downloads"}`;
}

export function versionStatusLabel(status: string): string {
  if (status === "live") return "Live";
  if (status === "scanning") return "Scanning";
  if (status === "quarantined") return "Quarantined";
  return status;
}

export function versionStatusClass(status: string): string {
  if (status === "live") return "status-ok";
  if (status === "scanning") return "status-warn";
  if (status === "quarantined") return "status-bad";
  return "";
}

export function excerpt(text: string, max = 140): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}…`;
}

function zipStem(filename: string): string {
  return filename.replace(/\.zip$/i, "").replace(/-\d+(?:\.\d+)*$/, "");
}

export function looksLikeZipName(value: string, filename?: string): boolean {
  const compact = value.replace(/[\s_-]+/g, "").toLowerCase();
  if (!compact) return true;
  if (/\s/.test(value.trim())) return false;
  if (filename) {
    const stem = zipStem(filename).replace(/[\s_-]+/g, "").toLowerCase();
    if (compact === stem) return true;
  }
  return /^[a-z0-9]+$/i.test(value.replace(/[-_]/g, ""));
}

export function catalogDisplayTitle(name: string, filename?: string): string {
  const trimmed = name.trim();
  if (!looksLikeZipName(trimmed, filename)) return trimmed;
  const spaced = trimmed
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const withoutBrand = spaced.replace(/^Spirit\s*Vale\s+/i, "").trim();
  return withoutBrand || spaced || trimmed;
}
