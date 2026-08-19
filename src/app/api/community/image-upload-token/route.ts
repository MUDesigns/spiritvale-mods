import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { modImages } from "@/db/schema";
import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, MAX_IMAGES_PER_MOD } from "@/lib/constants";
import { unauthorized } from "@/lib/auth";
import { hasClerk } from "@/lib/clerk";
import { hasDatabase, requireModAccess } from "@/lib/catalog";
import { isCatalogId, isImageFilename, sanitizeImagePathname } from "@/lib/ids";
import { consumeUserRateLimit } from "@/lib/rate-limit";
import { issueUpload, requestOrigin } from "@/lib/upload-token";

export const dynamic = "force-dynamic";

type Payload = {
  pathname?: string;
  id?: string;
  contentType?: string;
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

  const limited = await consumeUserRateLimit(userId);
  if (limited) return limited;

  const body = (await request.json()) as Payload;
  const id = body.id?.trim() ?? "";
  if (!isCatalogId(id)) {
    return Response.json({ error: "A valid mod id is required." }, { status: 400 });
  }
  const owned = await requireModAccess(id, userId);
  if (!owned.ok) {
    return Response.json({ error: owned.error }, { status: owned.status });
  }
  const pathname = sanitizeImagePathname(body.pathname ?? "", id);
  if (!pathname || !isImageFilename(pathname)) {
    return Response.json(
      { error: "Upload path must be mods/{id}/images/{uuid}/{file}." },
      { status: 400 },
    );
  }
  const contentType = body.contentType?.trim().toLowerCase() ?? "";
  if (contentType && !(IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return Response.json({ error: "Screenshots must be PNG, JPEG, WebP, or GIF." }, { status: 400 });
  }
  const existing = await owned.db
    .select({ id: modImages.id })
    .from(modImages)
    .where(eq(modImages.modId, id));
  if (existing.length >= MAX_IMAGES_PER_MOD) {
    return Response.json(
      { error: `A mod can have at most ${MAX_IMAGES_PER_MOD} screenshots.` },
      { status: 400 },
    );
  }

  return Response.json(
    issueUpload({
      pathname,
      maxBytes: IMAGE_MAX_BYTES,
      userId,
      origin: requestOrigin(request),
    }),
  );
}
