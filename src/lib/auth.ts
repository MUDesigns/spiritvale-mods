import { isCatalogAdmin } from "@/lib/admin";
import { userIdFromApiKey } from "@/lib/api-keys";
import { hasDatabase } from "@/db";
import { API_KEY_PREFIX } from "@/lib/constants";

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export function requirePublishToken(request: Request): Response | null {
  const expected = process.env.PUBLISH_TOKEN?.trim();
  if (!expected) {
    return Response.json(
      { error: "PUBLISH_TOKEN is not configured on the catalog server." },
      { status: 500 },
    );
  }
  const token = bearerToken(request);
  if (!token || token !== expected) {
    return unauthorized();
  }
  return null;
}

/** Site publish token, or an svm_ API key that belongs to a catalog admin. */
export async function requirePublisher(request: Request): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) return unauthorized();

  const expected = process.env.PUBLISH_TOKEN?.trim();
  if (expected && token === expected) return null;

  if (token.startsWith(API_KEY_PREFIX)) {
    if (!hasDatabase()) {
      return Response.json({ error: "API keys require DATABASE_URL." }, { status: 503 });
    }
    const userId = await userIdFromApiKey(token);
    if (userId && (await isCatalogAdmin(userId))) return null;
    return unauthorized();
  }

  if (!expected) {
    return Response.json(
      { error: "PUBLISH_TOKEN is not configured on the catalog server." },
      { status: 500 },
    );
  }
  return unauthorized();
}
