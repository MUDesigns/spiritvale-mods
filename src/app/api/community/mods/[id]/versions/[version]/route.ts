import { deleteOwnedModVersion, writeResultResponse } from "@/lib/catalog";
import { isCatalogId, isVersion } from "@/lib/ids";
import { communityReady, requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id, version } = await context.params;
  if (!isCatalogId(id) || !isVersion(version)) {
    return Response.json({ error: "Invalid mod id or version." }, { status: 400 });
  }

  return writeResultResponse(await deleteOwnedModVersion(id, version, user.userId));
}
