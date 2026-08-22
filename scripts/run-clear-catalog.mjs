import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(file, keys) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const match = line.match(/^(PUBLISH_TOKEN|CATALOG_URL)=(.*)$/);
    if (!match || !keys.includes(match[1])) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['']$/g, "");
  }
}

const root = path.join(import.meta.dirname, "..");
loadEnvFile(path.join(root, ".env.local"), ["PUBLISH_TOKEN", "CATALOG_URL"]);

const publishToken = process.env.PUBLISH_TOKEN;
if (!publishToken) {
  throw new Error("PUBLISH_TOKEN is required.");
}

const url = (process.env.CATALOG_URL || "https://www.spiritvalemods.com").replace(
  /\/$/,
  "",
);

const res = await fetch(`${url}/api/publish/clear-catalog`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${publishToken}`,
    "X-Confirm-Clear": "DELETE-ALL-MODS",
  },
});
console.log("clear", res.status, await res.text());

const cat = await fetch(`${url}/api/catalog`);
const body = await cat.json();
console.log(
  "catalog",
  "paused=",
  body.paused,
  "mods=",
  (body.mods || []).map((m) => m.id).join(", ") || "(empty)",
  "app=",
  body.app?.version ?? "(none)",
);
