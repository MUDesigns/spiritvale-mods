import { requirePublisher } from "@/lib/auth";
import { upsertAppArtifact } from "@/lib/catalog";
import { isVersion, safeFilename } from "@/lib/ids";

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
  const denied = await requirePublisher(request);
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

  const next = await upsertAppArtifact({
    version,
    changelog: body.changelog?.trim() || undefined,
    artifact,
    filename,
    sha256,
    sizeBytes,
    downloadUrl,
  });
  return Response.json(next);
}
