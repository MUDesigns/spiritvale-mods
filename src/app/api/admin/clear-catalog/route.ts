import { rm } from "node:fs/promises";
import path from "node:path";
import { requirePublisher } from "@/lib/auth";
import { getDb } from "@/db";
import { appRelease, modImages, modVersions, mods } from "@/db/schema";
import { deleteStoredBlob, storageRoot } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Destructive cutover helper: wipe all catalog mods and the published app release.
 * Protected by PUBLISH_TOKEN (same as trusted uploads).
 */
export async function POST(request: Request) {
  const denied = await requirePublisher(request);
  if (denied) return denied;

  const confirm = request.headers.get("x-confirm-clear");
  if (confirm !== "DELETE-ALL-MODS") {
    return Response.json(
      { error: "Send header X-Confirm-Clear: DELETE-ALL-MODS to proceed." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [versionRows, imageRows, modRows] = await Promise.all([
    db.select({ blobPath: modVersions.blobPath }).from(modVersions),
    db.select({ blobPath: modImages.blobPath }).from(modImages),
    db.select({ id: mods.id }).from(mods),
  ]);

  await db.delete(modImages);
  await db.delete(modVersions);
  await db.delete(mods);
  await db.delete(appRelease);

  const blobPaths = [
    ...versionRows.map((r) => r.blobPath),
    ...imageRows.map((r) => r.blobPath),
  ].filter(Boolean) as string[];

  for (const blobPath of blobPaths) {
    try {
      await deleteStoredBlob(blobPath);
    } catch {
      // continue
    }
  }

  const root = storageRoot();
  for (const dir of ["mods", "app"]) {
    try {
      await rm(path.join(root, dir), { recursive: true, force: true });
    } catch {
      // continue
    }
  }

  return Response.json({
    ok: true,
    deletedMods: modRows.length,
    deletedBlobs: blobPaths.length,
  });
}
