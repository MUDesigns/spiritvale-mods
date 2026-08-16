import { loadCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadCatalog();
  return Response.json(catalog.app);
}
