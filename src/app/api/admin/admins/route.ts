import { currentUser } from "@clerk/nextjs/server";
import {
  grantCatalogAdmin,
  listCatalogAdmins,
  revokeCatalogAdmin,
} from "@/lib/admin";
import { communityReady, requireAdminSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

function actorEmails(user: {
  emailAddresses?: Array<{ emailAddress?: string }>;
}): string[] {
  return (user.emailAddresses ?? [])
    .map((entry) => entry.emailAddress?.trim().toLowerCase() ?? "")
    .filter(Boolean);
}

export async function GET() {
  const user = await requireAdminSession();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;
  return Response.json(await listCatalogAdmins());
}

export async function POST(request: Request) {
  const user = await requireAdminSession();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const result = await grantCatalogAdmin(body.email ?? "", user.userId);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, email: result.email });
}

export async function DELETE(request: Request) {
  const user = await requireAdminSession();
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const email = new URL(request.url).searchParams.get("email") ?? "";
  const session = await currentUser();
  const result = await revokeCatalogAdmin(email, actorEmails(session ?? {}));
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
