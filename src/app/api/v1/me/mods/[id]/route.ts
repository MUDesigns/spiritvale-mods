import { deleteOwnedMod, writeResultResponse } from "@/lib/catalog";
import { isCatalogId } from "@/lib/ids";
import { communityReady, requireApiKey } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireApiKey(request);
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  return writeResultResponse(await deleteOwnedMod(id, user.userId));
}
