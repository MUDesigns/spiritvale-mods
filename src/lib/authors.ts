import { clerkClient } from "@clerk/nextjs/server";
import { hasClerk } from "@/lib/clerk";

type ClerkLike = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  unsafeMetadata?: Record<string, unknown>;
  emailAddresses?: { emailAddress?: string }[];
  externalAccounts?: { provider: string; providerUserId?: string | null; externalId?: string | null }[];
};

const nameCache = new Map<string, { name: string; at: number }>();
const CACHE_MS = 5 * 60 * 1000;

export function displayNameFromClerk(user: ClerkLike): string {
  const meta = user.unsafeMetadata?.displayName;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  if (user.username?.trim()) return user.username.trim();
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  const email = user.emailAddresses?.[0]?.emailAddress?.split("@")[0];
  return email?.trim() || "Unknown";
}

export function discordUserIdFromClerk(user: ClerkLike): string | null {
  const account = user.externalAccounts?.find(
    (entry) => entry.provider === "discord" || entry.provider === "oauth_discord",
  );
  const id = account?.providerUserId || account?.externalId;
  return id?.trim() || null;
}

export async function authorNamesByUserId(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, string>();
  if (!unique.length || !hasClerk()) return result;

  const now = Date.now();
  const missing: string[] = [];
  for (const id of unique) {
    const cached = nameCache.get(id);
    if (cached && now - cached.at < CACHE_MS) result.set(id, cached.name);
    else missing.push(id);
  }
  if (!missing.length) return result;

  try {
    const client = await clerkClient();
    const page = await client.users.getUserList({ userId: missing, limit: 100 });
    const users = Array.isArray(page) ? page : page.data;
    for (const user of users) {
      const name = displayNameFromClerk(user);
      nameCache.set(user.id, { name, at: now });
      result.set(user.id, name);
    }
  } catch {
    // Catalog pages still render without author names.
  }
  return result;
}

export async function clerkIdentity(userId: string): Promise<{
  name: string;
  discordUserId: string | null;
} | null> {
  if (!userId || !hasClerk()) return null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return {
      name: displayNameFromClerk(user),
      discordUserId: discordUserIdFromClerk(user),
    };
  } catch {
    return null;
  }
}
