import { hasClerk } from "@/lib/clerk";
import { hasDatabase, setModHidden, writeResultResponse } from "@/lib/catalog";
import { isCatalogId } from "@/lib/ids";
import { requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  if (!hasClerk() || !hasDatabase()) {
    return Response.json(
      { error: "Community features require Clerk and DATABASE_URL." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  const body = (await request.json()) as { hidden?: unknown };
  if (typeof body.hidden !== "boolean") {
    return Response.json({ error: "hidden must be true or false." }, { status: 400 });
  }

  return writeResultResponse(await setModHidden(id, user.userId, body.hidden));
}
