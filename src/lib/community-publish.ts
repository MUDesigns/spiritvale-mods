import { isCatalogAdmin } from "@/lib/admin";
import { getModOwner, insertScanningVersion } from "@/lib/catalog";
import { COMMUNITY_MAX_BYTES, DESCRIPTION_MAX } from "@/lib/constants";
import {
  isCatalogId,
  isVersion,
  isZipFilename,
  safeFilename,
  sanitizeDescription,
  sanitizeQuarantinePathname,
} from "@/lib/ids";
import { consumeUserRateLimit } from "@/lib/rate-limit";
import { publicFileUrl } from "@/lib/store";

export type CommunityPublishInput = {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  changelog?: string;
  pathname?: string;
  downloadUrl?: string;
  sha256?: string;
  sizeBytes?: number;
  filename?: string;
};

function catalogFileUrl(pathname: string | null, requested?: string): string {
  if (!pathname) return "";
  const value = requested?.trim() ?? "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname.includes(".")) {
      return value;
    }
  } catch {
    // Client sent a Docker/localhost URL or omitted it.
  }
  return publicFileUrl(pathname);
}

export async function queueCommunityPublish(
  userId: string,
  body: CommunityPublishInput,
): Promise<Response> {
  const limited = await consumeUserRateLimit(userId);
  if (limited) return limited;

  const id = body.id?.trim() ?? "";
  const name = body.name?.trim() || id;
  const description =
    body.description === undefined ? undefined : sanitizeDescription(body.description ?? "");
  const version = body.version?.trim() ?? "";
  const pathname = sanitizeQuarantinePathname(body.pathname ?? "", userId);
  const filename = safeFilename(body.filename ?? pathname?.split("/").pop() ?? "");
  const sha256 = body.sha256?.trim().toLowerCase() ?? "";
  const sizeBytes = Number(body.sizeBytes ?? 0);
  const downloadUrl = catalogFileUrl(pathname, body.downloadUrl);

  if (
    !isCatalogId(id) ||
    !isVersion(version) ||
    !pathname ||
    !filename ||
    !isZipFilename(filename) ||
    !sha256 ||
    !sizeBytes ||
    sizeBytes > COMMUNITY_MAX_BYTES ||
    (body.description !== undefined && description === undefined)
  ) {
    return Response.json(
      {
        error:
          `id, version, zip filename, sha256, sizeBytes, and pathname are required (max 50 MB). Description max ${DESCRIPTION_MAX} characters.`,
      },
      { status: 400 },
    );
  }

  const owner = await getModOwner(id);
  if (owner === null && !(await isCatalogAdmin(userId))) {
    return Response.json(
      { error: "This catalog id is reserved and cannot be claimed." },
      { status: 403 },
    );
  }
  if (owner && owner !== userId) {
    return Response.json({ error: "You do not own this mod id." }, { status: 403 });
  }

  await insertScanningVersion({
    id,
    name,
    version,
    description,
    changelog: body.changelog?.trim() || undefined,
    filename,
    sha256,
    sizeBytes,
    downloadUrl,
    blobPath: pathname,
    ownerUserId: userId,
  });

  return Response.json({
    id,
    version,
    status: "scanning",
    message: "Upload received. It will appear in the catalog after a clean virus scan.",
  });
}
