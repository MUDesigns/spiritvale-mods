import { promoteVersionToLive, writeResultResponse } from "@/lib/catalog";
import { isCatalogId, isVersion } from "@/lib/ids";
import { communityReady, requireAdminSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const user = await requireAdminSession();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id, version } = await context.params;
  if (!isCatalogId(id) || !isVersion(version)) {
    return Response.json({ error: "Invalid mod id or version." }, { status: 400 });
  }

  return writeResultResponse(await promoteVersionToLive(id, version, user.userId));
}
