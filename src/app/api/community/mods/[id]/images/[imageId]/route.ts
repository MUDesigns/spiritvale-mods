import { deleteModImage, writeImageResult } from "@/lib/catalog";
import { isCatalogId } from "@/lib/ids";
import { communityReady, requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; imageId: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id, imageId } = await context.params;
  if (!isCatalogId(id) || !imageId) {
    return Response.json({ error: "Invalid image." }, { status: 400 });
  }
  return writeImageResult(await deleteModImage(id, user.userId, imageId));
}
