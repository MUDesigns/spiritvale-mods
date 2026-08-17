import { requirePublishToken } from "@/lib/auth";
import { upsertLiveModVersion } from "@/lib/catalog";
import { isCatalogId, isVersion, safeFilename, sanitizeDescription } from "@/lib/ids";

export const dynamic = "force-dynamic";

type VersionBody = {
  name?: string;
  description?: string;
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

  const description =
    body.description === undefined ? undefined : sanitizeDescription(body.description);
  if (body.description !== undefined && description === undefined) {
    return Response.json(
      { error: "Description is too long." },
      { status: 400 },
    );
  }

  const next = await upsertLiveModVersion({
    id,
    name,
    description,
    version,
    changelog: body.changelog?.trim() || undefined,
    filename,
    sha256,
    sizeBytes,
    downloadUrl,
  });
  return Response.json(next);
}
