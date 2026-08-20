import { catalogPausedResponse, isCatalogPaused } from "@/lib/catalog-pause";
import { loadCatalog } from "@/lib/catalog";
import { isCatalogId } from "@/lib/ids";
import { publicMod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (isCatalogPaused()) return catalogPausedResponse();
  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }
  const catalog = await loadCatalog();
  const mod = catalog.mods[id];
  if (!mod) {
    return Response.json({ error: "Mod not found." }, { status: 404 });
  }
  return Response.json(publicMod(mod));
}
