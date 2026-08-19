import { clerkUserIdForEmail } from "@/lib/admin";
import { requirePublisher } from "@/lib/auth";
import { isCatalogId } from "@/lib/ids";
import { setModOwner, writeResultResponse } from "@/lib/catalog";
import { requireAdminSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

async function requireAdminOrPublisher(request: Request) {
  if (!(await requirePublisher(request))) return { ok: true as const };
  const user = await requireAdminSession();
  if (user instanceof Response) return user;
  return { ok: true as const };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const allowed = await requireAdminOrPublisher(request);
  if (allowed instanceof Response) return allowed;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ownerUserId?: string;
    ownerEmail?: string;
  };
  const ownerUserId =
    body.ownerUserId?.trim() ||
    (body.ownerEmail ? await clerkUserIdForEmail(body.ownerEmail) : null);
  if (!ownerUserId) {
    return Response.json(
      { error: "ownerEmail or ownerUserId is required, and the email must have a catalog account." },
      { status: 400 },
    );
  }

  return writeResultResponse(await setModOwner(id, ownerUserId));
}
