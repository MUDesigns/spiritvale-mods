import { communityReady, requireApiKey } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireApiKey(request);
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;
  return Response.json({ ok: true, via: user.via });
}
