import { after } from "next/server";
import { getVersion, markVersionStatus, writeResultResponse } from "@/lib/catalog";
import { isCatalogId, isVersion } from "@/lib/ids";
import { scanVersion } from "@/lib/scan";
import { communityReady, requireAdminSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const user = await requireAdminSession();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const { id, version } = await context.params;
  if (!isCatalogId(id) || !isVersion(version)) {
    return Response.json({ error: "Invalid mod id or version." }, { status: 400 });
  }

  const row = await getVersion(id, version);
  if (!row) {
    return writeResultResponse({ error: "Version not found.", status: 404 });
  }
  if (row.status === "live") {
    return writeResultResponse({ error: "This file is already live.", status: 409 });
  }

  await markVersionStatus({
    modId: id,
    version,
    status: "scanning",
    scanSummary: "Queued for another scan by catalog admin.",
  });
  after(async () => {
    await scanVersion(id, version);
  });
  return Response.json({ ok: true, status: "scanning" });
}
