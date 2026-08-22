/**
 * Update overlay mod listing descriptions without a new version (no Discord notify).
 * Usage: node scripts/update-overlay-mod-descriptions.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const file = path.join(import.meta.dirname, "..", ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "");
    const m = line.match(/^(PUBLISH_TOKEN|CATALOG_URL)=(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].trim().replace(/^['"]|['']$/g, "");
  }
}

loadEnvLocal();

const publishToken = process.env.PUBLISH_TOKEN;
if (!publishToken) throw new Error("PUBLISH_TOKEN required");
const CATALOG_URL = (process.env.CATALOG_URL || "https://www.spiritvalemods.com").replace(
  /\/$/,
  "",
);

const sharedRequirements = `Requirements
- SpiritVale Plugin Manager from https://www.spiritvalemods.com
- Npcap with WinPcap API-compatible mode enabled (https://npcap.com/#download)
- .NET 8 Desktop Runtime (x64)

Install with Plugin Manager
1. Install Npcap and Plugin Manager first.
2. On this mod page, click Install with Plugin Manager (or use the Catalog tab inside the manager).
3. Confirm the browser opens Plugin Manager, then enable the plugin and show its HUD if needed.

Install the zip manually
1. Click Download zip on this page.
2. Open Plugin Manager, go to the Plugins tab, and choose Import zip.
3. Or extract the zip so the plugin DLL is under %AppData%\\SpiritValeOverlay\\plugins\\
4. Enable the plugin in the Plugins list if it is not already on.`;

const descriptions = {
  "spiritvale-overlay-cooldownmanager": `Overlay skill cooldown strip for SpiritVale. Tracks cast cooldowns from passive packet capture and shows them as a compact HUD.

${sharedRequirements}

Tips
- Ctrl+F3 opens the Cooldown Manager config while the plugin is loaded.
- The HUD hides when SpiritVale is closed or alt-tabbed away.`,

  "spiritvale-overlay-playernameplate": `Overlay player nameplate for SpiritVale with health, mana, cast bar, and aura icons driven by passive packet capture.

${sharedRequirements}

Tips
- Ctrl+F2 opens the Player Nameplate config while the plugin is loaded.
- The nameplate hides when SpiritVale is closed or alt-tabbed away.`,

  "spiritvale-overlay-dps-meter": `Overlay DPS meter for SpiritVale. Shows encounter damage, share bars, and optional skill breakdown from passive packet capture.

${sharedRequirements}

Tips
- Configure options from the Plugins tab in Plugin Manager.
- The meter hides when SpiritVale is closed or alt-tabbed away.`,
};

for (const [id, description] of Object.entries(descriptions)) {
  if (description.includes("\u2014") || description.includes("\u2013")) {
    throw new Error(`Description for ${id} still contains an em/en dash.`);
  }
  const res = await fetch(`${CATALOG_URL}/api/publish/mods/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${publishToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed ${id}: ${res.status} ${text}`);
  }
  console.log(`updated ${id}`);
}
