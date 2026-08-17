import { listUserMods } from "@/lib/catalog";
import { communityReady, requireApiKey } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireApiKey(request);
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { owned, versions } = await listUserMods(user.userId);
  return Response.json({
    mods: owned.map((mod) => ({
      id: mod.id,
      name: mod.name,
      description: mod.description,
    })),
    versions: versions.map((row) => ({
      id: row.modId,
      version: row.version,
      status: row.status,
      publishedAt: row.publishedAt,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
    })),
  });
}
