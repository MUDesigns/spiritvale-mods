import { auth } from "@clerk/nextjs/server";
import { COMMUNITY_MAX_BYTES } from "@/lib/constants";
import { unauthorized } from "@/lib/auth";
import { catalogPausedResponse, isCatalogPaused } from "@/lib/catalog-pause";
import { hasClerk } from "@/lib/clerk";
import { getModOwner, hasDatabase } from "@/lib/catalog";
import { isCatalogId, isVersion, isZipFilename, sanitizeQuarantinePathname } from "@/lib/ids";
import { consumeUserRateLimit } from "@/lib/rate-limit";
import { issueUpload, requestOrigin } from "@/lib/upload-token";

export const dynamic = "force-dynamic";

type Payload = {
  pathname?: string;
  id?: string;
  version?: string;
};

export async function POST(request: Request) {
  if (isCatalogPaused()) return catalogPausedResponse();
  const { userId } = await auth();
  if (!userId) return unauthorized();
  if (!hasClerk() || !hasDatabase()) {
    return Response.json(
      { error: "Community uploads require Clerk and DATABASE_URL." },
      { status: 503 },
    );
  }

  const limited = await consumeUserRateLimit(userId);
  if (limited) return limited;

  const body = (await request.json()) as Payload;
  const id = body.id?.trim() ?? "";
  const version = body.version?.trim() ?? "";
  if (!isCatalogId(id) || !isVersion(version)) {
    return Response.json(
      { error: "A valid mod id and version are required." },
      { status: 400 },
    );
  }
  const pathname = sanitizeQuarantinePathname(body.pathname ?? "", userId);
  if (!pathname || !isZipFilename(pathname)) {
    return Response.json(
      { error: "Upload path must be quarantine/{userId}/{uuid}/{file.zip}." },
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
  if (owner && owner !== userId) {
    return Response.json({ error: "You do not own this mod id." }, { status: 403 });
  }

  return Response.json(
    issueUpload({
      pathname,
      maxBytes: COMMUNITY_MAX_BYTES,
      userId,
      origin: requestOrigin(request),
    }),
  );
}
