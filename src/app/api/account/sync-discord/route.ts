import { notifyVerifiedModder } from "@/lib/discord-bridge";
import { requireSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  await notifyVerifiedModder(user.userId);
  return Response.json({ ok: true });
}
