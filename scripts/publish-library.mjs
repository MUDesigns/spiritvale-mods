import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { catalogPutFile } from "./catalog-put.mjs";

const CATALOG_URL = "https://www.spiritvalemods.com";
const LIBRARY = path.join(
  process.env.APPDATA,
  "com.matt0.spiritvale-mod-manager",
  "mods",
);
const MAP_PATH = path.join(
  process.env.APPDATA,
  "com.matt0.spiritvale-mod-publisher",
  "nexus-map.json",
);

function slugify(input) {
  let out = "";
  let lastDash = false;
  for (const ch of input) {
    if (/[a-z0-9]/i.test(ch)) {
      out += ch.toLowerCase();
      lastDash = false;
    } else if (!lastDash && out.length > 0) {
      out += "-";
      lastDash = true;
    }
  }
  return out.replace(/^-+|-+$/g, "");
}

function isCatalogId(value) {
  return /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
}

function isVersion(value) {
  return /^[A-Za-z0-9.+_-]{1,64}$/.test(value);
}

function loadEnvLocal() {
  const text = readFileSync(
    path.join(import.meta.dirname, "..", ".env.local"),
    "utf8",
  );
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(PUBLISH_TOKEN|CATALOG_URL)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

loadEnvLocal();

const publishToken = process.env.PUBLISH_TOKEN;
if (!publishToken) {
  throw new Error("PUBLISH_TOKEN is required.");
}

function hasNexusCredentials(meta) {
  return Boolean(String(meta?.fileId ?? "").trim() && String(meta?.modId ?? "").trim());
}

const map = JSON.parse(await readFile(MAP_PATH, "utf8"));
const files = (await readdir(LIBRARY)).filter((name) =>
  name.toLowerCase().endsWith(".zip"),
);

for (const zipFile of files) {
  const stem = path.parse(zipFile).name;
  const id = slugify(stem);
  if (!isCatalogId(id)) {
    console.warn(`skip ${zipFile}: invalid catalog id "${id}"`);
    continue;
  }
  const meta = map.mods?.[id] ?? {};
  if (!hasNexusCredentials(meta)) {
    console.warn(`skip ${zipFile}: no Nexus file ID / mod ID`);
    continue;
  }
  const version = isVersion(String(meta.lastVersion || "").trim())
    ? String(meta.lastVersion).trim()
    : "1";
  const name = (meta.displayName || stem).replace(/\s+/g, " ").trim() || id;
  const fullPath = path.join(LIBRARY, zipFile);
  const bytes = await readFile(fullPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const filename = `${id}.zip`;
  const pathname = `mods/${id}/${version}/${filename}`;

  console.log(`uploading ${name} (${id} v${version})...`);
  const downloadUrl = await catalogPutFile({
    catalogUrl: CATALOG_URL,
    publishToken,
    pathname,
    body: bytes,
    contentType: "application/zip",
  });

  const response = await fetch(`${CATALOG_URL}/api/mods/${id}/versions`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${publishToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      version,
      changelog: "",
      filename,
      sha256,
      sizeBytes: bytes.length,
      downloadUrl,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${id}: register failed (${response.status}): ${text}`);
  }
  console.log(`  ok ${id}`);
}

const catalog = await fetch(`${CATALOG_URL}/api/catalog`);
console.log("catalog:", await catalog.text());
