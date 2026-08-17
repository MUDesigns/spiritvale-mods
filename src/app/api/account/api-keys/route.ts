import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { hasDatabase } from "@/lib/catalog";
import { requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  if (!hasDatabase()) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }
  return Response.json({ keys: await listApiKeys(user.userId) });
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  if (!hasDatabase()) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const created = await createApiKey(user.userId, body.name ?? "");
  if ("error" in created) {
    return Response.json({ error: created.error }, { status: created.status });
  }
  return Response.json({
    key: created.key,
    ...created.record,
    message: "Copy this key now. It will not be shown again.",
  });
}
