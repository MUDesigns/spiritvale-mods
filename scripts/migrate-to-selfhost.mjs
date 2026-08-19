import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { list } from "@vercel/blob";
import { openSql } from "./db.mjs";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    if (process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

loadEnv(new URL("../.env.local", import.meta.url));

const root = path.join(import.meta.dirname, "..");
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.spiritvalemods.com"
).replace(/\/$/, "");
const storageDir =
  process.env.STORAGE_DIR?.trim() || path.join(root, "data", "storage");
const dumpPath =
  process.env.DUMP_PATH?.trim() || path.join(root, "backups", "neon.sql");

function usage() {
  console.log(`Migrate SpiritVale Mods off Neon + Vercel Blob.

Usage:
  node scripts/migrate-to-selfhost.mjs blobs     Copy Blob objects into STORAGE_DIR
  node scripts/migrate-to-selfhost.mjs dump      pg_dump DATABASE_URL to backups/neon.sql
  node scripts/migrate-to-selfhost.mjs rewrite   Rewrite blob.vercel-storage.com URLs
  node scripts/migrate-to-selfhost.mjs all       blobs + dump (does not rewrite)

Env (.env.local):
  DATABASE_URL              Neon (dump) or VPS Postgres (rewrite)
  TARGET_DATABASE_URL       Optional rewrite target; required if DATABASE_URL is Neon
  BLOB_READ_WRITE_TOKEN     Vercel Blob read token
  STORAGE_DIR               Destination folder (default ./data/storage)
  NEXT_PUBLIC_SITE_URL      Public origin for /files/... URLs
  DUMP_PATH                 pg_dump output (default ./backups/neon.sql)

Rewrite refuses neon.tech hosts unless you pass --force.
After dump, restore on the VPS with:
  psql "$VPS_DATABASE_URL" -f backups/neon.sql
Then copy STORAGE_DIR onto the catalog_storage volume and run rewrite against VPS Postgres.
`);
}

function rewriteUrl(value) {
  if (!value || typeof value !== "string") return value;
  try {
    const url = new URL(value);
    if (
      !url.hostname.includes("blob.vercel-storage.com") &&
      !url.hostname.includes("vercel-storage.com")
    ) {
      return value;
    }
    const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const encoded = pathname
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `${siteUrl}/files/${encoded}`;
  } catch {
    return value;
  }
}

function looksLikeNeon(url) {
  try {
    return new URL(url).hostname.includes("neon.tech");
  } catch {
    return /neon\.tech/i.test(url);
  }
}

async function copyBlobs() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to copy Vercel Blob objects.");
  }
  await mkdir(storageDir, { recursive: true });
  let cursor;
  let copied = 0;
  let skipped = 0;
  do {
    const page = await list({ token, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const pathname = String(blob.pathname ?? "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (!pathname || pathname.includes("..")) {
        console.warn(`skip invalid pathname: ${blob.pathname}`);
        skipped += 1;
        continue;
      }
      const dest = path.join(storageDir, ...pathname.split("/"));
      try {
        const response = await fetch(blob.downloadUrl || blob.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, Buffer.from(await response.arrayBuffer()));
        copied += 1;
        console.log(`copied ${pathname}`);
      } catch (error) {
        skipped += 1;
        console.warn(
          `failed ${pathname}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  console.log(`blobs done: copied ${copied}, skipped ${skipped} -> ${storageDir}`);
}

function dumpDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required for dump.");
  mkdirSync(path.dirname(dumpPath), { recursive: true });
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0]);
  const result = spawnSync(
    "pg_dump",
    [
      "--no-owner",
      "--no-acl",
      "--format=plain",
      `--file=${dumpPath}`,
      `--dbname=${url}`,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PGPASSWORD: decodeURIComponent(parsed.password || ""),
        PGSSLMODE: parsed.searchParams.get("sslmode") || "require",
      },
    },
  );
  if (result.error?.code === "ENOENT") {
    throw new Error(
      `pg_dump not found. Install PostgreSQL client tools, then retry. Target db=${dbName}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `pg_dump exited ${result.status}`);
  }
  console.log(`dumped ${dbName} -> ${dumpPath}`);
}

async function rewriteUrls(force) {
  const target =
    process.env.TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!target) {
    throw new Error("TARGET_DATABASE_URL or DATABASE_URL is required for rewrite.");
  }
  if (looksLikeNeon(target) && !force) {
    throw new Error(
      "Refusing to rewrite URLs on a Neon database. Set TARGET_DATABASE_URL to VPS Postgres or pass --force.",
    );
  }
  const sql = openSql(target);
  try {
    let changed = 0;
    const versions = await sql`SELECT id, download_url FROM mod_versions`;
    for (const row of versions) {
      const next = rewriteUrl(row.download_url);
      if (next !== row.download_url) {
        await sql`UPDATE mod_versions SET download_url = ${next} WHERE id = ${row.id}`;
        changed += 1;
      }
    }
    const images = await sql`SELECT id, url FROM mod_images`;
    for (const row of images) {
      const next = rewriteUrl(row.url);
      if (next !== row.url) {
        await sql`UPDATE mod_images SET url = ${next} WHERE id = ${row.id}`;
        changed += 1;
      }
    }
    const [app] = await sql`
      SELECT installer_download_url, portable_download_url FROM app_release WHERE id = 1
    `;
    if (app) {
      const installer = rewriteUrl(app.installer_download_url);
      const portable = rewriteUrl(app.portable_download_url);
      if (
        installer !== app.installer_download_url ||
        portable !== app.portable_download_url
      ) {
        await sql`
          UPDATE app_release
          SET installer_download_url = ${installer},
              portable_download_url = ${portable}
          WHERE id = 1
        `;
        changed += 1;
      }
    }
    console.log(`rewrote ${changed} URL(s) to ${siteUrl}/files/...`);
  } finally {
    await sql.end();
  }
}

const command = process.argv[2] || "help";
const force = process.argv.includes("--force");

if (command === "blobs") {
  await copyBlobs();
} else if (command === "dump") {
  dumpDatabase();
} else if (command === "rewrite") {
  await rewriteUrls(force);
} else if (command === "all") {
  await copyBlobs();
  dumpDatabase();
  console.log("Restore the dump on VPS Postgres, copy STORAGE_DIR, then run rewrite.");
} else {
  usage();
}
