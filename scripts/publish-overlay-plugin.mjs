/**
 * Publish one overlay plugin zip to spiritvalemods.com as a catalog mod.
 * Usage: node scripts/publish-overlay-plugin.mjs <id> <name> <version> <zipPath> [description]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { catalogPutFile } from "./catalog-put.mjs";

function loadEnvLocal() {
  const file = path.join(import.meta.dirname, "..", ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const m = line.match(/^(PUBLISH_TOKEN|CATALOG_URL)=(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

loadEnvLocal();

const [id, name, version, zipPath, ...descParts] = process.argv.slice(2);
if (!id || !name || !version || !zipPath) {
  console.error(
    "Usage: node scripts/publish-overlay-plugin.mjs <id> <name> <version> <zipPath> [description]",
  );
  process.exit(1);
}

const publishToken = process.env.PUBLISH_TOKEN;
if (!publishToken) throw new Error("PUBLISH_TOKEN required");
const CATALOG_URL = (process.env.CATALOG_URL || "https://www.spiritvalemods.com").replace(
  /\/$/,
  "",
);
const description = descParts.join(" ") || "";
const bytes = await readFile(zipPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const filename = path.basename(zipPath);
const pathname = `mods/${id}/${version}/${filename}`;

console.log(`uploading ${name} (${id} v${version})…`);
const downloadUrl = await catalogPutFile({
  catalogUrl: CATALOG_URL,
  publishToken,
  pathname,
  body: bytes,
  contentType: "application/zip",
});

const res = await fetch(`${CATALOG_URL}/api/mods/${id}/versions`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${publishToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name,
    description,
    version,
    changelog: description || `Release ${version}`,
    filename,
    sha256,
    sizeBytes: bytes.length,
    downloadUrl,
  }),
});
if (!res.ok) {
  throw new Error(`Register failed: ${res.status} ${await res.text()}`);
}
console.log(`registered ${id} v${version} ${sha256}`);
