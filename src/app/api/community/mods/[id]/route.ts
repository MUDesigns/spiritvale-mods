import { DESCRIPTION_MAX } from "@/lib/constants";
import {
  deleteOwnedMod,
  updateModMeta,
  writeResultResponse,
} from "@/lib/catalog";
import { isCatalogId, sanitizeDescription } from "@/lib/ids";
import { communityReady, requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

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

  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();
  const description =
    body.description === undefined ? undefined : sanitizeDescription(body.description);
  if (body.description !== undefined && description === undefined) {
    return Response.json(
      { error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` },
      { status: 400 },
    );
  }

  return writeResultResponse(
    await updateModMeta(id, user.userId, {
      name: name || undefined,
      description,
    }),
  );
}

export async function DELETE(
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

  return writeResultResponse(await deleteOwnedMod(id, user.userId));
}
