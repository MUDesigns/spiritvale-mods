import { rm } from "node:fs/promises";
import path from "node:path";
import { requirePublishToken } from "@/lib/auth";
import { getDb } from "@/db";
import { modImages, modVersions, mods } from "@/db/schema";
import {
  deleteStoredBlob,
  loadCatalogFromBlob,
  saveCatalog,
  storageRoot,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Destructive cutover helper: wipe all catalog mods (DB rows + blobs).
 * Also clears catalog.json mods so seedFromBlobIfEmpty cannot restore them.
 * Does not touch app_release — re-publish Plugin Manager separately if needed.
 * Protected by PUBLISH_TOKEN only (same as trusted uploads).
 */
export async function POST(request: Request) {
  const denied = requirePublishToken(request);
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

  try {
    await rm(path.join(storageRoot(), "mods"), { recursive: true, force: true });
  } catch {
    // continue
  }

  // Prevent seedFromBlobIfEmpty from re-inserting BepInEx catalog.json entries.
  const blob = await loadCatalogFromBlob();
  await saveCatalog({ mods: {}, app: blob.app ?? null });

  return Response.json({
    ok: true,
    deletedMods: modRows.length,
    deletedBlobs: blobPaths.length,
  });
}
