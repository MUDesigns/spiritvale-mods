import { SITE_URL } from "@/lib/constants";

export function trackedModDownloadUrl(id: string, version?: string): string {
  const url = new URL(`/api/mods/${id}/download`, SITE_URL);
  if (version) url.searchParams.set("version", version);
  return url.toString();
}
