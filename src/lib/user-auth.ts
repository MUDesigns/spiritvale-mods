import { auth } from "@clerk/nextjs/server";
import { isCatalogAdmin } from "@/lib/admin";
import { userIdFromApiKey } from "@/lib/api-keys";
import { bearerToken, unauthorized } from "@/lib/auth";
import { catalogPausedResponse, isCatalogPaused } from "@/lib/catalog-pause";
import { hasDatabase } from "@/lib/catalog";
import { hasClerk } from "@/lib/clerk";

export type CatalogUser = {
  userId: string;
  via: "session" | "apiKey";
};

export async function requireSessionUser(): Promise<CatalogUser | Response> {
  const { userId } = await auth();
  if (!userId) return unauthorized();
  return { userId, via: "session" };
}

export async function requireApiKey(request: Request): Promise<CatalogUser | Response> {
  const token = bearerToken(request);
  if (!token) return unauthorized();
  if (!hasDatabase()) {
    return Response.json(
      { error: "API keys require DATABASE_URL." },
      { status: 503 },
    );
  }
  const fromKey = await userIdFromApiKey(token);
  if (!fromKey) return unauthorized();
  return { userId: fromKey, via: "apiKey" };
}

export async function requireCatalogUser(request: Request): Promise<CatalogUser | Response> {
  const token = bearerToken(request);
  if (token.startsWith("svm_")) {
    return requireApiKey(request);
  }
  const { userId } = await auth();
  if (userId) return { userId, via: "session" };
  if (!token) return unauthorized();
  return requireApiKey(request);
}

export function communityReady(): Response | null {
  if (isCatalogPaused()) return catalogPausedResponse();
  if (!hasClerk() || !hasDatabase()) {
    return Response.json(
      { error: "Community uploads require Clerk and DATABASE_URL." },
      { status: 503 },
    );
  }
  return null;
}

export async function requireAdminSession(): Promise<CatalogUser | Response> {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  if (!(await isCatalogAdmin(user.userId))) {
    return Response.json({ error: "Admin only." }, { status: 403 });
  }
  return user;
}
