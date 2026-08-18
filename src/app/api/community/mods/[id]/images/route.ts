import { IMAGE_MAX_BYTES } from "@/lib/constants";
import {
  listModImages,
  registerModImage,
  setModThumbnail,
  writeImageResult,
} from "@/lib/catalog";
import { isCatalogId, isImageFilename, safeFilename, sanitizeImagePathname } from "@/lib/ids";
import { communityReady, requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }
  return writeImageResult(await listModImages(id, user.userId));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  const body = (await request.json()) as {
    pathname?: string;
    filename?: string;
    sizeBytes?: number;
    downloadUrl?: string;
    url?: string;
    setThumbnail?: boolean;
  };
  const filename = safeFilename(body.filename ?? "");
  const pathname = sanitizeImagePathname(body.pathname ?? "", id);
  if (!pathname || !filename || !isImageFilename(filename)) {
    return Response.json({ error: "A valid image file is required." }, { status: 400 });
  }
  const sizeBytes = Number(body.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > IMAGE_MAX_BYTES) {
    return Response.json(
      { error: `Images must be ${IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.` },
      { status: 400 },
    );
  }
  const url = (body.downloadUrl || body.url || "").trim();
  return writeImageResult(
    await registerModImage(id, user.userId, {
      pathname,
      filename,
      sizeBytes,
      url,
      setThumbnail: Boolean(body.setThumbnail),
    }),
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  const body = (await request.json()) as { thumbnailImageId?: string };
  const thumbnailImageId = body.thumbnailImageId?.trim() ?? "";
  if (!thumbnailImageId) {
    return Response.json({ error: "thumbnailImageId is required." }, { status: 400 });
  }
  return writeImageResult(await setModThumbnail(id, user.userId, thumbnailImageId));
}
