import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { catalogPutFile } from "./catalog-put.mjs";

function loadEnvFile(file, keys) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const match = line.match(/^(PUBLISH_TOKEN|CATALOG_URL)=(.*)$/);
    if (!match || !keys.includes(match[1])) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const root = path.join(import.meta.dirname, "..");
loadEnvFile(path.join(root, ".env.local"), ["PUBLISH_TOKEN", "CATALOG_URL"]);

const publishToken = process.env.PUBLISH_TOKEN;
if (!publishToken) {
  throw new Error("PUBLISH_TOKEN is required.");
}

const CATALOG_URL = (
  process.env.CATALOG_URL || "https://www.spiritvalemods.com"
).replace(/\/$/, "");
const VERSION = "0.1.6";
const CHANGELOG =
  "Click a catalog mod title to open its page, icon-only row actions, and Update All when catalog updates are available.";

const INSTALLER =
  "X:\\projects\\spiritvale-mod-manager\\src-tauri\\target\\release\\bundle\\nsis\\SpiritVale Mod Manager_0.1.6_x64-setup.exe";
const PORTABLE =
  "X:\\projects\\spiritvale-mod-manager\\src-tauri\\target\\release\\bundle\\portable\\SpiritValeModManager-portable.zip";

const ARTIFACTS = [
  { artifact: "installer", file: INSTALLER, contentType: "application/octet-stream" },
  { artifact: "portable", file: PORTABLE, contentType: "application/zip" },
];

for (const item of ARTIFACTS) {
  const bytes = await readFile(item.file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const filename = path.basename(item.file);
  const downloadUrl = await catalogPutFile({
    catalogUrl: CATALOG_URL,
    publishToken,
    pathname: `app/${VERSION}/${filename}`,
    body: bytes,
    contentType: item.contentType,
  });
  const res = await fetch(`${CATALOG_URL}/api/app/versions`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${publishToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: VERSION,
      changelog: CHANGELOG,
      artifact: item.artifact,
      filename,
      sha256,
      sizeBytes: bytes.length,
      downloadUrl,
    }),
  });
  if (!res.ok) {
    throw new Error(`Register ${item.artifact} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`registered ${item.artifact} ${VERSION} ${bytes.length} ${sha256}`);
}
