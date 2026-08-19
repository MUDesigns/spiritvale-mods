import { readFileSync } from "node:fs";
import { openSql } from "./db.mjs";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

loadEnvLocal();

const sql = openSql();
try {
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM mods`;
  if (Number(count) > 0) {
    console.log(`seed skipped: ${count} mods already present`);
  } else {

const catalog = await fetch("https://www.spiritvalemods.com/api/catalog").then(
  (res) => res.json(),
);

for (const mod of catalog.mods ?? []) {
  await sql`
    INSERT INTO mods (id, name, owner_user_id)
    VALUES (${mod.id}, ${mod.name}, NULL)
    ON CONFLICT (id) DO NOTHING
  `;
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
    await sql`
      INSERT INTO mod_versions (
        mod_id, version, changelog, filename, sha256, size_bytes,
        download_url, blob_path, status, published_at
      )
      VALUES (
        ${mod.id}, ${entry.version}, ${entry.changelog ?? null}, ${entry.filename},
        ${entry.sha256}, ${entry.sizeBytes}, ${entry.downloadUrl},
        ${`mods/${mod.id}/${entry.version}/${entry.filename}`},
        'live', ${new Date(entry.publishedAt)}
      )
      ON CONFLICT (mod_id, version) DO NOTHING
    `;
  }
}

const app = catalog.app;
if (app) {
  await sql`
    INSERT INTO app_release (
      id, version, changelog, published_at,
      installer_filename, installer_sha256, installer_size_bytes, installer_download_url,
      portable_filename, portable_sha256, portable_size_bytes, portable_download_url
    )
    VALUES (
      1, ${app.version}, ${app.changelog ?? null}, ${new Date(app.publishedAt)},
      ${app.installer?.filename ?? null}, ${app.installer?.sha256 ?? null},
      ${app.installer?.sizeBytes ?? null}, ${app.installer?.downloadUrl ?? null},
      ${app.portable?.filename ?? null}, ${app.portable?.sha256 ?? null},
      ${app.portable?.sizeBytes ?? null}, ${app.portable?.downloadUrl ?? null}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

const [{ modsNow }] = await sql`SELECT count(*)::int AS "modsNow" FROM mods`;
console.log(`seed complete: ${modsNow} mods`);
  }
} finally {
  await sql.end();
}
