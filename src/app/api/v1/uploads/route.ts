import { isCatalogAdmin } from "@/lib/admin";
import { getModOwner } from "@/lib/catalog";
import { COMMUNITY_MAX_BYTES } from "@/lib/constants";
import { isCatalogId, isVersion, isZipFilename, safeFilename } from "@/lib/ids";
import { communityReady, requireApiKey } from "@/lib/user-auth";
import { consumeUserRateLimit } from "@/lib/rate-limit";
import { issueUpload, requestOrigin } from "@/lib/upload-token";

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
  const limited = await consumeUserRateLimit(user.userId);
  if (limited) return limited;

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
  if (owner === null && !(await isCatalogAdmin(user.userId))) {
    return Response.json(
      { error: "This catalog id is reserved and cannot be claimed." },
      { status: 403 },
    );
  }
  if (owner && owner !== user.userId) {
    return Response.json({ error: "You do not own this mod id." }, { status: 403 });
  }

  const pathname = `quarantine/${user.userId}/${crypto.randomUUID()}/${filename}`;
  return Response.json(
    issueUpload({
      pathname,
      maxBytes: COMMUNITY_MAX_BYTES,
      userId: user.userId,
      origin: requestOrigin(request),
    }),
  );
}
