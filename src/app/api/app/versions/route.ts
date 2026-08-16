import { requirePublishToken } from "@/lib/auth";
import { isVersion, safeFilename } from "@/lib/ids";
import { loadCatalog, saveCatalog } from "@/lib/store";
import type { AppRelease, CatalogArtifact } from "@/lib/types";

export const dynamic = "force-dynamic";

type AppVersionBody = {
  version?: string;
  changelog?: string;
  artifact?: "installer" | "portable";
  filename?: string;
  sha256?: string;
  sizeBytes?: number;
  downloadUrl?: string;
};

export async function PUT(request: Request) {
  const denied = requirePublishToken(request);
  if (denied) return denied;

  const body = (await request.json()) as AppVersionBody;
  const version = body.version?.trim() ?? "";
  const artifact = body.artifact;
  const filename = safeFilename(body.filename ?? "");
  const sha256 = body.sha256?.trim().toLowerCase() ?? "";
  const downloadUrl = body.downloadUrl?.trim() ?? "";
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (
    !isVersion(version) ||
    (artifact !== "installer" && artifact !== "portable") ||
    !filename ||
    !sha256 ||
    !downloadUrl ||
    !sizeBytes
  ) {
    return Response.json(
      {
        error:
          "version, artifact (installer|portable), filename, sha256, sizeBytes, and downloadUrl are required.",
      },
      { status: 400 },
    );
  }

  const publishedAt = new Date().toISOString();
  const file: CatalogArtifact = { filename, sha256, sizeBytes, downloadUrl };
  const catalog = await loadCatalog();
  const current = catalog.app;
  const next: AppRelease =
    current && current.version === version
      ? { ...current, changelog: body.changelog?.trim() || current.changelog, publishedAt }
      : {
          version,
          changelog: body.changelog?.trim() || undefined,
          publishedAt,
          installer: undefined,
          portable: undefined,
        };

  if (artifact === "installer") next.installer = file;
  if (artifact === "portable") next.portable = file;
  catalog.app = next;
  await saveCatalog(catalog);
  return Response.json(next);
}
