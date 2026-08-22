/**
 * Destructive: delete all catalog mods (+ blobs) and clear app_release.
 * Uses DATABASE_URL + STORAGE_DIR from .env.local (or env).
 * Run only against the production catalog after backup.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadEnvLocal() {
  const file = path.join(import.meta.dirname, "..", ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");

const storage =
  process.env.STORAGE_DIR || path.join(import.meta.dirname, "..", "data", "storage");

const sql = postgres(url, { max: 1, ssl: process.env.DATABASE_SSL === "false" ? false : "prefer" });

const mods = await sql`select id from mods`;
console.log(`Deleting ${mods.length} mod(s)…`);
await sql`delete from mod_images`;
await sql`delete from mod_versions`;
await sql`delete from mods`;
await sql`delete from app_release`;

const modsDir = path.join(storage, "mods");
const appDir = path.join(storage, "app");
if (existsSync(modsDir)) {
  rmSync(modsDir, { recursive: true, force: true });
  console.log(`Removed ${modsDir}`);
}
if (existsSync(appDir)) {
  rmSync(appDir, { recursive: true, force: true });
  console.log(`Removed ${appDir}`);
}

await sql.end();
console.log("Catalog cleared (mods + app_release).");
