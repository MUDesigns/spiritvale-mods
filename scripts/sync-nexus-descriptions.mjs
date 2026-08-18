import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const GRAPHQL_URL = "https://api.nexusmods.com/v2/graphql";
const CATALOG_URL = "https://www.spiritvalemods.com";
const DESCRIPTION_MAX = 8000;
const MAP_PATH = `${process.env.APPDATA}/com.matt0.spiritvale-mod-publisher/nexus-map.json`;

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#92;/g, "\\")
    .replace(/&amp;/g, "&");
}

function nexusToPlain(raw) {
  let text = String(raw ?? "").replace(/\r\n/g, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/\[br\s*\/?]/gi, "\n");
  text = text.replace(/\[line]/gi, "\n———\n");
  text = text.replace(/\[heading]([\s\S]*?)\[\/heading]/gi, "\n$1\n");
  text = text.replace(/\[url=[^\]]+]([\s\S]*?)\[\/url]/gi, "$1");
  text = text.replace(/\[code]([\s\S]*?)\[\/code]/gi, "$1");
  text = text.replace(/\[list(?:=\d+)?]/gi, "\n");
  text = text.replace(/\[\/list]/gi, "\n");
  text = text.replace(/\[\*\]([\s\S]*?)\[\/\*]/gi, "\n• $1");
  text = text.replace(/\[\*]/gi, "\n• ");
  text = text.replace(/\[\/?(?:b|i|u|color|size|font|center|left|right)(?:=[^\]]+)?]/gi, "");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text)
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "—")
    .replace(/\uFFFD/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length <= DESCRIPTION_MAX) return text;
  return `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

async function fetchNexusMods() {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "SpiritVale-Mods-Catalog/0.1 (description sync)",
    },
    body: JSON.stringify({
      query: `query SpiritValeMods($filter: ModsFilter, $count: Int) {
        mods(filter: $filter, count: $count) {
          nodes { uid modId name summary description }
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
  return json.data?.mods?.nodes ?? [];
}

loadEnvLocal();
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const catalog = await fetch(`${CATALOG_URL}/api/catalog`).then((res) => res.json());
const nexusMods = await fetchNexusMods();
const byUid = new Map(nexusMods.map((mod) => [String(mod.uid), mod]));
const sql = neon(process.env.DATABASE_URL);

let updated = 0;
for (const mod of catalog.mods ?? []) {
  const mapped = map.mods?.[mod.id];
  const nexus = mapped?.modId ? byUid.get(String(mapped.modId)) : null;
  if (!nexus) {
    console.warn(`skip ${mod.id}: no Nexus match`);
    continue;
  }
  const description = nexusToPlain(nexus.description || nexus.summary || "");
  if (!description) {
    console.warn(`skip ${mod.id}: empty Nexus description`);
    continue;
  }
  await sql`
    UPDATE mods
    SET description = ${description}, updated_at = now()
    WHERE id = ${mod.id}
  `;
  updated += 1;
  console.log(`updated ${mod.id} from Nexus #${nexus.modId} (${description.length} chars)`);
}

console.log(`done: ${updated} mods`);
