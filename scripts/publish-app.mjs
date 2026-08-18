import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

function loadEnvFile(file, keys) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const match = line.match(/^(BLOB_READ_WRITE_TOKEN|PUBLISH_TOKEN)=(.*)$/);
    if (!match || !keys.includes(match[1])) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const root = path.join(import.meta.dirname, "..");
loadEnvFile(path.join(root, ".env.local"), [
  "BLOB_READ_WRITE_TOKEN",
  "PUBLISH_TOKEN",
]);

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const publishToken = process.env.PUBLISH_TOKEN;
if (!blobToken || !publishToken) {
  throw new Error("BLOB_READ_WRITE_TOKEN and PUBLISH_TOKEN are required.");
}

const CATALOG_URL = "https://www.spiritvalemods.com";
const VERSION = "0.1.4";
const CHANGELOG =
  "Install with Mod Manager from spiritvalemods.com adds the zip to your library.";

const INSTALLER =
  "X:\\projects\\spiritvale-mod-manager\\src-tauri\\target\\release\\bundle\\nsis\\SpiritVale Mod Manager_0.1.4_x64-setup.exe";
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
  const blob = await put(`app/${VERSION}/${filename}`, bytes, {
    access: "public",
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: item.contentType,
  });
  const downloadUrl = blob.downloadUrl || blob.url;
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
