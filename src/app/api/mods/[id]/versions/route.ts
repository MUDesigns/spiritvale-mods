import { requirePublishToken } from "@/lib/auth";
import { isCatalogId, isVersion, safeFilename } from "@/lib/ids";
import { loadCatalog, saveCatalog } from "@/lib/store";
import type { CatalogMod, CatalogVersion } from "@/lib/types";

export const dynamic = "force-dynamic";

type VersionBody = {
  name?: string;
  version?: string;
  changelog?: string;
  filename?: string;
  sha256?: string;
  sizeBytes?: number;
  downloadUrl?: string;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = requirePublishToken(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  const body = (await request.json()) as VersionBody;
  const name = body.name?.trim() || id;
  const version = body.version?.trim() ?? "";
  const filename = safeFilename(body.filename ?? "");
  const sha256 = body.sha256?.trim().toLowerCase() ?? "";
  const downloadUrl = body.downloadUrl?.trim() ?? "";
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!isVersion(version) || !filename || !sha256 || !downloadUrl || !sizeBytes) {
    return Response.json(
      { error: "version, filename, sha256, sizeBytes, and downloadUrl are required." },
      { status: 400 },
    );
  }

  const publishedAt = new Date().toISOString();
  const entry: CatalogVersion = {
    version,
    changelog: body.changelog?.trim() || undefined,
    filename,
    sha256,
    sizeBytes,
    downloadUrl,
    publishedAt,
  };

  const catalog = await loadCatalog();
  const existing = catalog.mods[id];
  const versions = [
    entry,
    ...(existing?.versions ?? []).filter((item) => item.version !== version),
  ].slice(0, 25);

  const next: CatalogMod = {
    id,
    name,
    latestVersion: version,
    changelog: entry.changelog,
    filename,
    sha256,
    sizeBytes,
    downloadUrl,
    publishedAt,
    versions,
  };
  catalog.mods[id] = next;
  await saveCatalog(catalog);
  return Response.json(next);
}
