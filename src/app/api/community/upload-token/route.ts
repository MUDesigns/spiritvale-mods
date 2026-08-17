import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { COMMUNITY_MAX_BYTES } from "@/lib/constants";
import { unauthorized } from "@/lib/auth";
import { hasClerk } from "@/lib/clerk";
import { getModOwner, hasDatabase } from "@/lib/catalog";
import { isCatalogId, isVersion, isZipFilename, sanitizeQuarantinePathname } from "@/lib/ids";
import { consumeUserRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Payload = {
  id?: string;
  version?: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();
  if (!hasClerk() || !hasDatabase()) {
    return Response.json(
      { error: "Community uploads require Clerk and DATABASE_URL." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  if (
    typeof body === "object" &&
    body &&
    "type" in body &&
    body.type === "blob.generate-client-token"
  ) {
    const limited = await consumeUserRateLimit(userId);
    if (limited) return limited;
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: Payload = {};
        try {
          payload = JSON.parse(clientPayload ?? "{}") as Payload;
        } catch {
          throw new Error("Invalid upload payload.");
        }
        const id = payload.id?.trim() ?? "";
        const version = payload.version?.trim() ?? "";
        if (!isCatalogId(id) || !isVersion(version)) {
          throw new Error("A valid mod id and version are required.");
        }
        const safePath = sanitizeQuarantinePathname(pathname, userId);
        if (!safePath || !isZipFilename(pathname)) {
          throw new Error("Upload path must be quarantine/{userId}/{uuid}/{file.zip}.");
        }
        const owner = await getModOwner(id);
        if (owner === null) {
          throw new Error("This catalog id is reserved and cannot be claimed.");
        }
        if (owner && owner !== userId) {
          throw new Error("You do not own this mod id.");
        }
        return {
          maximumSizeInBytes: COMMUNITY_MAX_BYTES,
          allowedContentTypes: [
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream",
          ],
          addRandomSuffix: false,
          allowOverwrite: true,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId, id, version, pathname: safePath }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload token failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
