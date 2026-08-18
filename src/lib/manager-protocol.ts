export function managerInstallUrl(id: string): string {
  return `spiritvale://install/${encodeURIComponent(id)}`;
}
