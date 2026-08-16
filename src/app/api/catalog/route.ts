import { loadCatalog } from "@/lib/store";
import { publicMod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadCatalog();
  const mods = Object.values(catalog.mods)
    .map(publicMod)
    .sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({ mods, app: catalog.app });
}
