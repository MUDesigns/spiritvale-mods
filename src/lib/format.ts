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
