import {
  CATALOG_PAGE_SIZE,
  CATALOG_PAGE_SIZE_MAX,
} from "@/lib/constants";
import { parseCatalogSort, queryPublicMods } from "@/lib/catalog";
import { isCatalogPaused } from "@/lib/catalog-pause";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isCatalogPaused()) {
    return Response.json({
      mods: [],
      total: 0,
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
      paused: true,
    });
  }
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const requestedSize = Number(url.searchParams.get("pageSize") || CATALOG_PAGE_SIZE);
  const result = await queryPublicMods({
    q: url.searchParams.get("q") ?? "",
    sort: parseCatalogSort(url.searchParams.get("sort")),
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(requestedSize)
      ? Math.min(requestedSize, CATALOG_PAGE_SIZE_MAX)
      : CATALOG_PAGE_SIZE,
  });
  return Response.json(result);
}
