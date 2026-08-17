import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { modImages } from "@/db/schema";
import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, MAX_IMAGES_PER_MOD } from "@/lib/constants";
import { unauthorized } from "@/lib/auth";
import { hasClerk } from "@/lib/clerk";
import { hasDatabase, requireModAccess } from "@/lib/catalog";
import { isCatalogId, isImageFilename, sanitizeImagePathname } from "@/lib/ids";
import { consumeUserRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Payload = {
  id?: string;
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
        if (!isCatalogId(id)) {
          throw new Error("A valid mod id is required.");
        }
        const owned = await requireModAccess(id, userId);
        if (!owned.ok) {
          throw new Error(owned.error);
        }
        const safePath = sanitizeImagePathname(pathname, id);
        if (!safePath || !isImageFilename(pathname)) {
          throw new Error("Upload path must be mods/{id}/images/{uuid}/{file}.");
        }
        const existing = await owned.db
          .select({ id: modImages.id })
          .from(modImages)
          .where(eq(modImages.modId, id));
        if (existing.length >= MAX_IMAGES_PER_MOD) {
          throw new Error(`A mod can have at most ${MAX_IMAGES_PER_MOD} screenshots.`);
        }
        return {
          maximumSizeInBytes: IMAGE_MAX_BYTES,
          allowedContentTypes: [...IMAGE_CONTENT_TYPES, "application/octet-stream"],
          addRandomSuffix: false,
          allowOverwrite: true,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId, id, pathname: safePath }),
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
