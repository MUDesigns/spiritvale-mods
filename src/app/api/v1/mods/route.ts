import { after } from "next/server";
import { queueCommunityPublish } from "@/lib/community-publish";
import { scanVersion } from "@/lib/scan";
import { communityReady, requireApiKey } from "@/lib/user-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await requireApiKey(request);
  if (user instanceof Response) return user;
  const denied = communityReady();
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown>;
  const response = await queueCommunityPublish(user.userId, body);
  if (response.ok) {
    const id = String(body.id ?? "").trim();
    const version = String(body.version ?? "").trim();
    if (id && version) {
      after(async () => {
        await scanVersion(id, version);
      });
    }
  }
  return response;
}
