import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { catalogPutFile } from "./catalog-put.mjs";
import { openSql } from "./db.mjs";

const GRAPHQL_URL = "https://api.nexusmods.com/v2/graphql";
const CATALOG_URL = "https://www.spiritvalemods.com";
const MAP_PATH = `${process.env.APPDATA}/com.matt0.spiritvale-mod-publisher/nexus-map.json`;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_MOD = 16;
const FORCE = process.argv.includes("--force");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 SpiritVale-Mods-Catalog/0.1";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extFromUrlOrType(url, contentType) {
  const path = String(url).split("?")[0].toLowerCase();
  if (path.endsWith(".png") || contentType.includes("png")) return "png";
  if (path.endsWith(".webp") || contentType.includes("webp")) return "webp";
  if (path.endsWith(".gif") || contentType.includes("gif")) return "gif";
  if (path.endsWith(".jpeg") || path.endsWith(".jpg") || contentType.includes("jpeg")) {
    return "jpg";
  }
  return "jpg";
}

function contentTypeFor(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function isThumbUrl(url) {
  return /\/thumbnails?\//i.test(url) || /_thumb(?:nail)?/i.test(url);
}

function normalizeUrl(value) {
  return String(value ?? "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .trim();
}

function uniqueImageUrls(urls) {
  const full = [];
  const thumbs = [];
  const seen = new Set();
  for (const raw of urls) {
    const url = normalizeUrl(raw).split("?")[0];
    if (!/^https:\/\/(?:staticdelivery|images)\.nexusmods\.com\//i.test(url)) continue;
    if (!/\.(png|jpe?g|webp|gif)$/i.test(url.split("?")[0])) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    if (isThumbUrl(url)) thumbs.push(url);
    else full.push(url);
  }
  return full.length ? full : thumbs;
}

function extractImageUrls(html) {
  const matches = String(html).match(/https:\\?\/\\?\/staticdelivery\.nexusmods\.com\/[^"'\\\s<>]+/gi) ?? [];
  return uniqueImageUrls(matches);
}

async function fetchNexusMods() {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "SpiritVale-Mods-Catalog/0.1 (image sync)",
    },
    body: JSON.stringify({
      query: `query SpiritValeMods($filter: ModsFilter, $count: Int) {
        mods(filter: $filter, count: $count) {
          nodes {
            uid
            modId
            name
            pictureUrl
            thumbnailLargeUrl
            thumbnailUrl
            game { id domainName }
          }
        }
      }`,
      variables: {
        count: 100,
        filter: { gameDomainName: [{ value: "spiritvale", op: "EQUALS" }] },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Nexus GraphQL failed (${response.status})`);
  }
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((item) => item.message).join("; "));
  }
  return json.data?.mods?.nodes ?? [];
}

async function scrapeNexusImages(modId, gameId) {
  const urls = [];
  const pages = [
    `https://www.nexusmods.com/spiritvale/mods/${modId}?tab=images`,
    gameId
      ? `https://www.nexusmods.com/Core/Libs/Common/Widgets/ModImagesTab?id=${modId}&game_id=${gameId}`
      : null,
  ].filter(Boolean);

  for (const page of pages) {
    try {
      const response = await fetch(page, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) continue;
      urls.push(...extractImageUrls(await response.text()));
    } catch {
      // Cloudflare or widget blocks are common; GraphQL pictureUrl is the fallback.
    }
    await sleep(350);
  }
  return uniqueImageUrls(urls);
}

loadEnvLocal();
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}
if (!process.env.PUBLISH_TOKEN) {
  throw new Error("PUBLISH_TOKEN is required.");
}

const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const catalog = await fetch(`${CATALOG_URL}/api/catalog`).then((res) => res.json());
const nexusMods = await fetchNexusMods();
const byUid = new Map(nexusMods.map((mod) => [String(mod.uid), mod]));
const sql = openSql();
try {
await sql`ALTER TABLE mods ADD COLUMN IF NOT EXISTS thumbnail_image_id text`;
await sql`
  CREATE TABLE IF NOT EXISTS mod_images (
    id text PRIMARY KEY,
    mod_id text NOT NULL REFERENCES mods(id) ON DELETE CASCADE,
    url text NOT NULL,
    blob_path text NOT NULL,
    filename text NOT NULL,
    size_bytes bigint NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    source_url text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS mod_images_mod_id ON mod_images (mod_id)`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS mod_images_blob_path ON mod_images (blob_path)`;

let imported = 0;
let skipped = 0;
for (const mod of catalog.mods ?? []) {
  const mapped = map.mods?.[mod.id];
  const nexus = mapped?.modId ? byUid.get(String(mapped.modId)) : null;
  if (!nexus) {
    console.warn(`skip ${mod.id}: no Nexus match`);
    skipped += 1;
    continue;
  }

  const existing = await sql`
    SELECT id, source_url, url
    FROM mod_images
    WHERE mod_id = ${mod.id}
    ORDER BY sort_order ASC, created_at ASC
  `;
  if (existing.length > 0 && !FORCE) {
    console.log(`skip ${mod.id}: already has ${existing.length} images`);
    skipped += 1;
    continue;
  }
  if (existing.length >= MAX_IMAGES_PER_MOD) {
    console.log(`skip ${mod.id}: already has ${existing.length} images`);
    skipped += 1;
    continue;
  }

  const known = new Set(
    existing.flatMap((row) => [row.source_url, row.url].filter(Boolean).map(normalizeUrl)),
  );
  const urls = uniqueImageUrls([
    nexus.pictureUrl,
    nexus.thumbnailLargeUrl,
    ...(await scrapeNexusImages(nexus.modId, nexus.game?.id)),
  ]).filter((url) => !known.has(normalizeUrl(url)));

  if (urls.length === 0) {
    console.warn(`skip ${mod.id}: no Nexus images found`);
    skipped += 1;
    continue;
  }

  let added = 0;
  let sortOrder = existing.length;
  const [current] = await sql`SELECT thumbnail_image_id FROM mods WHERE id = ${mod.id}`;
  let thumbnailId = current?.thumbnail_image_id ?? null;

  for (const sourceUrl of urls) {
    if (existing.length + added >= MAX_IMAGES_PER_MOD) break;
    let response;
    try {
      response = await fetch(sourceUrl, { headers: { "User-Agent": UA, Accept: "image/*" } });
    } catch (error) {
      console.warn(`skip image for ${mod.id}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (!response.ok) {
      console.warn(`skip image for ${mod.id}: HTTP ${response.status} ${sourceUrl}`);
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 1024 || buffer.byteLength > IMAGE_MAX_BYTES) {
      console.warn(`skip image for ${mod.id}: ${buffer.byteLength} bytes`);
      continue;
    }
    const ext = extFromUrlOrType(sourceUrl, response.headers.get("content-type") ?? "");
    const imageId = randomUUID();
    const filename = `nexus-${added + 1}.${ext}`;
    const blobPath = `mods/${mod.id}/images/${imageId}/${filename}`;
    const url = await catalogPutFile({
      catalogUrl: CATALOG_URL,
      publishToken: process.env.PUBLISH_TOKEN,
      pathname: blobPath,
      body: buffer,
      contentType: contentTypeFor(ext),
    });
    await sql`
      INSERT INTO mod_images (id, mod_id, url, blob_path, filename, size_bytes, sort_order, source_url)
      VALUES (
        ${imageId},
        ${mod.id},
        ${url},
        ${blobPath},
        ${filename},
        ${buffer.byteLength},
        ${sortOrder},
        ${sourceUrl}
      )
    `;
    if (!thumbnailId) thumbnailId = imageId;
    sortOrder += 1;
    added += 1;
    imported += 1;
    console.log(`added ${mod.id} image ${added} from Nexus #${nexus.modId}`);
    await sleep(200);
  }

  if (thumbnailId && !current?.thumbnail_image_id) {
    await sql`
      UPDATE mods
      SET thumbnail_image_id = ${thumbnailId}, updated_at = now()
      WHERE id = ${mod.id}
    `;
  } else if (added > 0) {
    await sql`UPDATE mods SET updated_at = now() WHERE id = ${mod.id}`;
  }
  if (added === 0) skipped += 1;
}

console.log(`done: imported ${imported} images, skipped ${skipped} mods`);
} finally {
  await sql.end();
}
