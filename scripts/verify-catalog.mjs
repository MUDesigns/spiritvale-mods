const url = (process.env.CATALOG_URL || "https://www.spiritvalemods.com").replace(
  /\/$/,
  "",
);
const res = await fetch(`${url}/api/catalog?t=${Date.now()}`);
const text = await res.text();
console.log("status", res.status, "bytes", text.length);
if (!text.trim()) {
  console.log("empty body");
  process.exit(1);
}
const j = JSON.parse(text);
console.log(
  JSON.stringify(
    {
      paused: j.paused,
      count: (j.mods || []).length,
      ids: (j.mods || []).map((m) => `${m.id}:${m.latestVersion}`),
      app: j.app?.version ?? null,
    },
    null,
    2,
  ),
);
