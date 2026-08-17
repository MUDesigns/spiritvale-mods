import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { getModOwner } from "@/lib/catalog";
import { COMMUNITY_MAX_BYTES } from "@/lib/constants";
import { isCatalogId, isVersion, isZipFilename, safeFilename } from "@/lib/ids";
import { communityReady, requireApiKey } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type UploadBody = {
  id?: string;
  version?: string;
  filename?: string;
};

export async function POST(request: Request) {
  const user = await requireApiKey(request);
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const body = (await request.json()) as UploadBody;
  const id = body.id?.trim() ?? "";
  const version = body.version?.trim() ?? "";
  const filename = safeFilename(body.filename ?? "");
  if (!isCatalogId(id) || !isVersion(version) || !isZipFilename(filename)) {
    return Response.json(
      { error: "id, version, and a .zip filename are required." },
      { status: 400 },
    );
  }

  const owner = await getModOwner(id);
  if (owner === null) {
    return Response.json(
      { error: "This catalog id is reserved and cannot be claimed." },
      { status: 403 },
    );
  }
  if (owner && owner !== user.userId) {
    return Response.json({ error: "You do not own this mod id." }, { status: 403 });
  }

  const pathname = `quarantine/${user.userId}/${crypto.randomUUID()}/${filename}`;
  const validUntil = Date.now() + 60 * 60 * 1000;
  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    maximumSizeInBytes: COMMUNITY_MAX_BYTES,
    allowedContentTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    addRandomSuffix: false,
    allowOverwrite: true,
    validUntil,
  });

  return Response.json({
    pathname,
    clientToken,
    validUntil,
    maximumSizeInBytes: COMMUNITY_MAX_BYTES,
  });
}
