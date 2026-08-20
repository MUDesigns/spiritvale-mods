import { loadCatalog } from "@/lib/catalog";
import { isCatalogPaused } from "@/lib/catalog-pause";
import { publicMod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isCatalogPaused()) {
    return Response.json({ mods: [], app: null, paused: true });
  }
  const catalog = await loadCatalog();
  const mods = Object.values(catalog.mods)
    .map(publicMod)
    .sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({ mods, app: catalog.app });
}
