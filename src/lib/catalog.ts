import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb, getSql, hasDatabase } from "@/db";
import { appRelease, mods, modVersions } from "@/db/schema";
import { ensureSchema } from "@/db/migrate";
import { MAX_VERSIONS_PER_MOD } from "@/lib/constants";
import { isCatalogAdmin } from "@/lib/admin";
import {
  deleteStoredBlob,
  loadCatalogFromBlob,
  publishModZip,
  saveCatalog as saveCatalogToBlob,
} from "@/lib/store";
import type {
  AppRelease,
  Catalog,
  CatalogArtifact,
  CatalogMod,
  CatalogSort,
  PublicModPage,
  PublicModSummary,
} from "@/lib/types";
import { publicModSummary } from "@/lib/types";

export { hasDatabase };

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function artifactFrom(
  filename: string | null,
  sha256: string | null,
  sizeBytes: number | null,
  downloadUrl: string | null,
): CatalogArtifact | undefined {
  if (!filename || !sha256 || !sizeBytes || !downloadUrl) return undefined;
  return { filename, sha256, sizeBytes, downloadUrl };
}

async function ensureCatalog(): Promise<void> {
  await ensureSchema();
  await seedFromBlobIfEmpty();
}

async function seedFromBlobIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mods);
  if (count > 0) return;

  const blob = await loadCatalogFromBlob();
  for (const mod of Object.values(blob.mods)) {
    await db.insert(mods).values({
      id: mod.id,
      name: mod.name,
      description: mod.description || null,
      ownerUserId: null,
    });
    const versions = (mod.versions ?? []).length
      ? mod.versions
      : [
          {
            version: mod.latestVersion,
            changelog: mod.changelog,
            filename: mod.filename,
            sha256: mod.sha256,
            sizeBytes: mod.sizeBytes,
            downloadUrl: mod.downloadUrl,
            publishedAt: mod.publishedAt,
          },
        ];
    for (const entry of versions) {
      await db.insert(modVersions).values({
        modId: mod.id,
        version: entry.version,
        changelog: entry.changelog ?? null,
        filename: entry.filename,
        sha256: entry.sha256,
        sizeBytes: entry.sizeBytes,
        downloadUrl: entry.downloadUrl,
        blobPath: `mods/${mod.id}/${entry.version}/${entry.filename}`,
        status: "live",
        publishedAt: new Date(entry.publishedAt),
        uploaderUserId: null,
      });
    }
  }

  if (blob.app) {
    await db.insert(appRelease).values({
      id: 1,
      version: blob.app.version,
      changelog: blob.app.changelog ?? null,
      publishedAt: new Date(blob.app.publishedAt),
      installerFilename: blob.app.installer?.filename ?? null,
      installerSha256: blob.app.installer?.sha256 ?? null,
      installerSizeBytes: blob.app.installer?.sizeBytes ?? null,
      installerDownloadUrl: blob.app.installer?.downloadUrl ?? null,
      portableFilename: blob.app.portable?.filename ?? null,
      portableSha256: blob.app.portable?.sha256 ?? null,
      portableSizeBytes: blob.app.portable?.sizeBytes ?? null,
      portableDownloadUrl: blob.app.portable?.downloadUrl ?? null,
    });
  }
}

async function loadCatalogFromDb(): Promise<Catalog> {
  const db = getDb();
  const [modRows, versionRows, appRows] = await Promise.all([
    db.select().from(mods),
    db
      .select()
      .from(modVersions)
      .where(eq(modVersions.status, "live"))
      .orderBy(desc(modVersions.publishedAt)),
    db.select().from(appRelease).where(eq(appRelease.id, 1)).limit(1),
  ]);

  const versionsByMod = new Map<string, typeof versionRows>();
  for (const row of versionRows) {
    const list = versionsByMod.get(row.modId) ?? [];
    list.push(row);
    versionsByMod.set(row.modId, list);
  }

  const catalogMods: Record<string, CatalogMod> = {};
  for (const mod of modRows) {
    const history = (versionsByMod.get(mod.id) ?? []).slice(0, MAX_VERSIONS_PER_MOD);
    const latest = history[0];
    if (!latest) continue;
    catalogMods[mod.id] = {
      id: mod.id,
      name: mod.name,
      description: mod.description ?? undefined,
      latestVersion: latest.version,
      changelog: latest.changelog ?? undefined,
      filename: latest.filename,
      sha256: latest.sha256,
      sizeBytes: latest.sizeBytes,
      downloadUrl: latest.downloadUrl,
      publishedAt: asIso(latest.publishedAt),
      versions: history.map((item) => ({
        version: item.version,
        changelog: item.changelog ?? undefined,
        filename: item.filename,
        sha256: item.sha256,
        sizeBytes: item.sizeBytes,
        downloadUrl: item.downloadUrl,
        publishedAt: asIso(item.publishedAt),
      })),
    };
  }

  const appRow = appRows[0];
  const app: AppRelease | null = appRow
    ? {
        version: appRow.version,
        changelog: appRow.changelog ?? undefined,
        publishedAt: asIso(appRow.publishedAt),
        installer: artifactFrom(
          appRow.installerFilename,
          appRow.installerSha256,
          appRow.installerSizeBytes,
          appRow.installerDownloadUrl,
        ),
        portable: artifactFrom(
          appRow.portableFilename,
          appRow.portableSha256,
          appRow.portableSizeBytes,
          appRow.portableDownloadUrl,
        ),
      }
    : null;

  return { mods: catalogMods, app };
}

export async function loadCatalog(): Promise<Catalog> {
  if (!hasDatabase()) {
    return loadCatalogFromBlob();
  }
  await ensureCatalog();
  return loadCatalogFromDb();
}

export async function getModOwner(id: string): Promise<string | null | undefined> {
  if (!hasDatabase()) return undefined;
  await ensureCatalog();
  const db = getDb();
  const [row] = await db.select().from(mods).where(eq(mods.id, id)).limit(1);
  return row ? row.ownerUserId : undefined;
}

export async function upsertLiveModVersion(input: {
  id: string;
  name: string;
  description?: string;
  version: string;
  changelog?: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  blobPath?: string;
  ownerUserId?: string | null;
  uploaderUserId?: string | null;
}): Promise<CatalogMod> {
  if (!hasDatabase()) {
    const catalog = await loadCatalogFromBlob();
    const publishedAt = new Date().toISOString();
    const entry = {
      version: input.version,
      changelog: input.changelog,
      filename: input.filename,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      publishedAt,
    };
    const existing = catalog.mods[input.id];
    const versions = [
      entry,
      ...(existing?.versions ?? []).filter((item) => item.version !== input.version),
    ].slice(0, MAX_VERSIONS_PER_MOD);
    const next: CatalogMod = {
      id: input.id,
      name: input.name,
      description: input.description ?? existing?.description,
      latestVersion: input.version,
      changelog: input.changelog,
      filename: input.filename,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      publishedAt,
      versions,
    };
    catalog.mods[input.id] = next;
    await saveCatalogToBlob(catalog);
    return next;
  }

  await ensureCatalog();
  const db = getDb();
  const publishedAt = new Date();
  const blobPath =
    input.blobPath ?? `mods/${input.id}/${input.version}/${input.filename}`;

  const [existing] = await db.select().from(mods).where(eq(mods.id, input.id)).limit(1);
  if (!existing) {
    await db.insert(mods).values({
      id: input.id,
      name: input.name,
      description: input.description || null,
      ownerUserId: input.ownerUserId ?? null,
    });
  } else {
    await db
      .update(mods)
      .set({
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        updatedAt: publishedAt,
      })
      .where(eq(mods.id, input.id));
  }

  await db
    .insert(modVersions)
    .values({
      modId: input.id,
      version: input.version,
      changelog: input.changelog ?? null,
      filename: input.filename,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      blobPath,
      status: "live",
      publishedAt,
      uploaderUserId: input.uploaderUserId ?? null,
    })
    .onConflictDoUpdate({
      target: [modVersions.modId, modVersions.version],
      set: {
        changelog: input.changelog ?? null,
        filename: input.filename,
        sha256: input.sha256,
        sizeBytes: input.sizeBytes,
        downloadUrl: input.downloadUrl,
        blobPath,
        status: "live",
        scanSummary: null,
        vtId: null,
        publishedAt,
        uploaderUserId: input.uploaderUserId ?? null,
      },
    });

  const catalog = await loadCatalogFromDb();
  return catalog.mods[input.id];
}

export async function upsertAppArtifact(input: {
  version: string;
  changelog?: string;
  artifact: "installer" | "portable";
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
}): Promise<AppRelease> {
  if (!hasDatabase()) {
    const catalog = await loadCatalogFromBlob();
    const publishedAt = new Date().toISOString();
    const file: CatalogArtifact = {
      filename: input.filename,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
    };
    const current = catalog.app;
    const next: AppRelease =
      current && current.version === input.version
        ? {
            ...current,
            changelog: input.changelog?.trim() || current.changelog,
            publishedAt,
          }
        : {
            version: input.version,
            changelog: input.changelog?.trim() || undefined,
            publishedAt,
            installer: undefined,
            portable: undefined,
          };
    if (input.artifact === "installer") next.installer = file;
    if (input.artifact === "portable") next.portable = file;
    catalog.app = next;
    await saveCatalogToBlob(catalog);
    return next;
  }

  await ensureCatalog();
  const db = getDb();
  const publishedAt = new Date();
  const [current] = await db
    .select()
    .from(appRelease)
    .where(eq(appRelease.id, 1))
    .limit(1);

  const sameVersion = current?.version === input.version;
  const base = sameVersion
    ? {
        version: current.version,
        changelog: input.changelog?.trim() || current.changelog,
        publishedAt,
        installerFilename: current.installerFilename,
        installerSha256: current.installerSha256,
        installerSizeBytes: current.installerSizeBytes,
        installerDownloadUrl: current.installerDownloadUrl,
        portableFilename: current.portableFilename,
        portableSha256: current.portableSha256,
        portableSizeBytes: current.portableSizeBytes,
        portableDownloadUrl: current.portableDownloadUrl,
      }
    : {
        version: input.version,
        changelog: input.changelog?.trim() || null,
        publishedAt,
        installerFilename: null as string | null,
        installerSha256: null as string | null,
        installerSizeBytes: null as number | null,
        installerDownloadUrl: null as string | null,
        portableFilename: null as string | null,
        portableSha256: null as string | null,
        portableSizeBytes: null as number | null,
        portableDownloadUrl: null as string | null,
      };

  if (input.artifact === "installer") {
    base.installerFilename = input.filename;
    base.installerSha256 = input.sha256;
    base.installerSizeBytes = input.sizeBytes;
    base.installerDownloadUrl = input.downloadUrl;
  } else {
    base.portableFilename = input.filename;
    base.portableSha256 = input.sha256;
    base.portableSizeBytes = input.sizeBytes;
    base.portableDownloadUrl = input.downloadUrl;
  }

  await db
    .insert(appRelease)
    .values({ id: 1, ...base })
    .onConflictDoUpdate({
      target: appRelease.id,
      set: base,
    });

  const catalog = await loadCatalogFromDb();
  return catalog.app!;
}

export async function insertScanningVersion(input: {
  id: string;
  name: string;
  description?: string;
  version: string;
  changelog?: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  blobPath: string;
  ownerUserId: string;
}): Promise<{ versionRowId: number }> {
  await ensureCatalog();
  const db = getDb();
  const publishedAt = new Date();

  const [existing] = await db.select().from(mods).where(eq(mods.id, input.id)).limit(1);
  if (!existing) {
    await db.insert(mods).values({
      id: input.id,
      name: input.name,
      description: input.description || null,
      ownerUserId: input.ownerUserId,
    });
  } else {
    await db
      .update(mods)
      .set({
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        updatedAt: publishedAt,
      })
      .where(eq(mods.id, input.id));
  }

  const [row] = await db
    .insert(modVersions)
    .values({
      modId: input.id,
      version: input.version,
      changelog: input.changelog ?? null,
      filename: input.filename,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      blobPath: input.blobPath,
      status: "scanning",
      publishedAt,
      uploaderUserId: input.ownerUserId,
    })
    .onConflictDoUpdate({
      target: [modVersions.modId, modVersions.version],
      set: {
        changelog: input.changelog ?? null,
        filename: input.filename,
        sha256: input.sha256,
        sizeBytes: input.sizeBytes,
        downloadUrl: input.downloadUrl,
        blobPath: input.blobPath,
        status: "scanning",
        scanSummary: null,
        vtId: null,
        publishedAt,
        uploaderUserId: input.ownerUserId,
      },
    })
    .returning({ id: modVersions.id });

  return { versionRowId: row?.id ?? 0 };
}

export async function markVersionStatus(input: {
  modId: string;
  version: string;
  status: "live" | "quarantined" | "scanning";
  downloadUrl?: string;
  blobPath?: string;
  scanSummary?: string;
  vtId?: string;
}): Promise<void> {
  await ensureCatalog();
  const db = getDb();
  await db
    .update(modVersions)
    .set({
      status: input.status,
      ...(input.downloadUrl ? { downloadUrl: input.downloadUrl } : {}),
      ...(input.blobPath ? { blobPath: input.blobPath } : {}),
      ...(input.scanSummary !== undefined ? { scanSummary: input.scanSummary } : {}),
      ...(input.vtId !== undefined ? { vtId: input.vtId } : {}),
      publishedAt: new Date(),
    })
    .where(
      and(eq(modVersions.modId, input.modId), eq(modVersions.version, input.version)),
    );
}

export async function listUserMods(userId: string) {
  await ensureCatalog();
  const db = getDb();
  const owned = await db.select().from(mods).where(eq(mods.ownerUserId, userId));
  const ownedIds = owned.map((mod) => mod.id);
  const uploaded = await db
    .select()
    .from(modVersions)
    .where(eq(modVersions.uploaderUserId, userId))
    .orderBy(desc(modVersions.publishedAt));
  const ownedVersions =
    ownedIds.length === 0
      ? []
      : await db
          .select()
          .from(modVersions)
          .where(inArray(modVersions.modId, ownedIds))
          .orderBy(desc(modVersions.publishedAt));

  const versions = [...ownedVersions];
  const seen = new Set(ownedVersions.map((row) => row.id));
  for (const row of uploaded) {
    if (seen.has(row.id)) continue;
    versions.push(row);
  }
  return { owned, versions };
}

export async function listAdminCatalog() {
  await ensureCatalog();
  const db = getDb();
  const [modRows, versionRows] = await Promise.all([
    db.select().from(mods).orderBy(mods.name),
    db.select().from(modVersions).orderBy(desc(modVersions.publishedAt)),
  ]);
  return { mods: modRows, versions: versionRows };
}

export async function listStuckScanning(olderThanMs: number) {
  await ensureCatalog();
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanMs);
  return db
    .select()
    .from(modVersions)
    .where(
      and(eq(modVersions.status, "scanning"), lt(modVersions.publishedAt, cutoff)),
    );
}

export async function getVersion(modId: string, version: string) {
  await ensureCatalog();
  const db = getDb();
  const [row] = await db
    .select()
    .from(modVersions)
    .where(and(eq(modVersions.modId, modId), eq(modVersions.version, version)))
    .limit(1);
  return row;
}

const SORT_SQL: Record<CatalogSort, string> = {
  name: "name ASC, id ASC",
  newest: '"publishedAt" DESC',
  oldest: '"publishedAt" ASC',
  size: '"sizeBytes" DESC, name ASC',
};

export function parseCatalogSort(value: string | null | undefined): CatalogSort {
  if (value === "name" || value === "newest" || value === "oldest" || value === "size") {
    return value;
  }
  return "newest";
}

function likeNeedle(query: string): string {
  return `%${query.replace(/[%_\\]/g, "")}%`;
}

function asSummary(row: {
  id: string;
  name: string;
  description: string | null;
  latestVersion: string;
  changelog: string | null;
  filename: string;
  sha256: string;
  sizeBytes: number | string;
  downloadUrl: string;
  publishedAt: Date | string;
}): PublicModSummary {
  return publicModSummary({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    latestVersion: row.latestVersion,
    changelog: row.changelog ?? "",
    filename: row.filename,
    sha256: row.sha256,
    sizeBytes: Number(row.sizeBytes),
    downloadUrl: row.downloadUrl,
    publishedAt: asIso(row.publishedAt),
  });
}

function pageFromCatalog(
  catalog: Catalog,
  q: string,
  sort: CatalogSort,
  page: number,
  pageSize: number,
): PublicModPage {
  const needle = q.toLowerCase();
  let mods = Object.values(catalog.mods).map(publicModSummary);
  if (needle) {
    mods = mods.filter((mod) =>
      [mod.name, mod.id, mod.description].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }
  mods.sort((a, b) => {
    if (sort === "size") return b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name);
    if (sort === "oldest") return a.publishedAt.localeCompare(b.publishedAt);
    if (sort === "newest") return b.publishedAt.localeCompare(a.publishedAt);
    return a.name.localeCompare(b.name);
  });
  const total = mods.length;
  const start = (page - 1) * pageSize;
  return { mods: mods.slice(start, start + pageSize), total, page, pageSize };
}

export async function queryPublicMods(input: {
  q?: string;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}): Promise<PublicModPage> {
  const q = (input.q ?? "").trim();
  const sort = input.sort ?? "newest";
  const pageSize = Math.min(
    Math.max(1, input.pageSize ?? 20),
    50,
  );
  const page = Math.max(1, input.page ?? 1);

  if (!hasDatabase()) {
    return pageFromCatalog(await loadCatalogFromBlob(), q, sort, page, pageSize);
  }

  await ensureCatalog();
  const sql = getSql();
  const like = likeNeedle(q);
  const offset = (page - 1) * pageSize;
  const rows = (await sql.query(
    `
    WITH latest AS (
      SELECT DISTINCT ON (mod_id)
        mod_id, version, changelog, filename, sha256, size_bytes, download_url, published_at
      FROM mod_versions
      WHERE status = 'live'
      ORDER BY mod_id, published_at DESC
    ),
    filtered AS (
      SELECT
        m.id,
        m.name,
        COALESCE(m.description, '') AS description,
        l.version AS "latestVersion",
        COALESCE(l.changelog, '') AS changelog,
        l.filename,
        l.sha256,
        l.size_bytes AS "sizeBytes",
        l.download_url AS "downloadUrl",
        l.published_at AS "publishedAt"
      FROM mods m
      INNER JOIN latest l ON l.mod_id = m.id
      WHERE $1 = '' OR m.name ILIKE $2 OR m.id ILIKE $2 OR COALESCE(m.description, '') ILIKE $2
    )
    SELECT *, COUNT(*) OVER()::int AS total
    FROM filtered
    ORDER BY ${SORT_SQL[sort]}
    LIMIT $3 OFFSET $4
    `,
    [q, like, pageSize, offset],
  )) as Array<
    Parameters<typeof asSummary>[0] & { total: number }
  >;

  const total = rows[0]?.total ?? 0;
  return {
    mods: rows.map(asSummary),
    total,
    page,
    pageSize,
  };
}

export type OwnedModWriteResult = { ok: true } | { error: string; status: number };

export function writeResultResponse(result: OwnedModWriteResult): Response {
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}

type OwnedModContext =
  | { ok: true; db: ReturnType<typeof getDb> }
  | { ok: false; error: string; status: number };

async function requireModAccess(id: string, userId: string): Promise<OwnedModContext> {
  if (!hasDatabase()) {
    return { ok: false, error: "Database is not configured.", status: 503 };
  }
  await ensureCatalog();
  const db = getDb();
  const [existing] = await db.select().from(mods).where(eq(mods.id, id)).limit(1);
  if (!existing) return { ok: false, error: "Mod not found.", status: 404 };
  if (existing.ownerUserId === userId || (await isCatalogAdmin(userId))) {
    return { ok: true, db };
  }
  return { ok: false, error: "You do not own this mod.", status: 403 };
}

export async function updateModMeta(
  id: string,
  userId: string,
  patch: { name?: string; description?: string },
): Promise<OwnedModWriteResult> {
  const owned = await requireModAccess(id, userId);
  if (!owned.ok) return owned;
  await owned.db
    .update(mods)
    .set({
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mods.id, id));
  return { ok: true };
}

export async function deleteOwnedModVersion(
  id: string,
  version: string,
  userId: string,
): Promise<OwnedModWriteResult> {
  const owned = await requireModAccess(id, userId);
  if (!owned.ok) return owned;

  const [row] = await owned.db
    .select()
    .from(modVersions)
    .where(and(eq(modVersions.modId, id), eq(modVersions.version, version)))
    .limit(1);
  if (!row) return { error: "Version not found.", status: 404 };

  await owned.db
    .delete(modVersions)
    .where(and(eq(modVersions.modId, id), eq(modVersions.version, version)));
  await owned.db
    .update(mods)
    .set({ updatedAt: new Date() })
    .where(eq(mods.id, id));
  await deleteStoredBlob(row.blobPath);
  return { ok: true };
}

export async function deleteOwnedMod(
  id: string,
  userId: string,
): Promise<OwnedModWriteResult> {
  const owned = await requireModAccess(id, userId);
  if (!owned.ok) return owned;

  const rows = await owned.db
    .select()
    .from(modVersions)
    .where(eq(modVersions.modId, id));
  await owned.db.delete(mods).where(eq(mods.id, id));
  await Promise.all(rows.map((row) => deleteStoredBlob(row.blobPath)));
  return { ok: true };
}

export async function promoteVersionToLive(
  id: string,
  version: string,
  userId: string,
): Promise<OwnedModWriteResult> {
  if (!(await isCatalogAdmin(userId))) {
    return { error: "Admin only.", status: 403 };
  }
  const row = await getVersion(id, version);
  if (!row) return { error: "Version not found.", status: 404 };
  if (row.status === "live") return { ok: true };
  if (row.status !== "quarantined" && row.status !== "scanning") {
    return { error: "Only scanning or quarantined files can be approved.", status: 400 };
  }

  const publicPath = `mods/${id}/${version}/${row.filename}`;
  let downloadUrl = row.downloadUrl;
  let blobPath = row.blobPath;
  if (row.blobPath !== publicPath) {
    try {
      const copied = await publishModZip(row.blobPath, publicPath);
      downloadUrl = copied.downloadUrl || copied.url;
      blobPath = publicPath;
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not copy the zip to the catalog.",
        status: 502,
      };
    }
  }

  const previous = row.scanSummary?.trim();
  await markVersionStatus({
    modId: id,
    version,
    status: "live",
    downloadUrl,
    blobPath,
    scanSummary: previous
      ? `Manually approved by catalog admin. Previous: ${previous}`
      : "Manually approved by catalog admin.",
  });
  if (row.blobPath !== blobPath) {
    await deleteStoredBlob(row.blobPath);
  }
  return { ok: true };
}
