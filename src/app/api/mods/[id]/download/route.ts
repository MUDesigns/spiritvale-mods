import { resolveModDownload } from "@/lib/catalog";
import { isCatalogId } from "@/lib/ids";

export const dynamic = "force-dynamic";

async function downloadResponse(
  id: string,
  version: string | null,
  count: boolean,
) {
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }
  const result = await resolveModDownload(id, version, { count });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: result.downloadUrl,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return downloadResponse(id, new URL(request.url).searchParams.get("version"), true);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return downloadResponse(id, new URL(request.url).searchParams.get("version"), false);
}
