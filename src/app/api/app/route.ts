import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadCatalog();
  return Response.json(catalog.app);
}
