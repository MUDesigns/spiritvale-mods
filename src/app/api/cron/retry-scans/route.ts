import { scanVersion } from "@/lib/scan";
import { listStuckScanning } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stuck = await listStuckScanning(10 * 60 * 1000);
  const results: { modId: string; version: string }[] = [];
  for (const row of stuck) {
    await scanVersion(row.modId, row.version);
    results.push({ modId: row.modId, version: row.version });
  }
  return Response.json({ retried: results.length, results });
}
