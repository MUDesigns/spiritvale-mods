import { revokeApiKey } from "@/lib/api-keys";
import { hasDatabase } from "@/lib/catalog";
import { requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  if (!hasDatabase()) {
    return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  const result = await revokeApiKey(user.userId, id);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
