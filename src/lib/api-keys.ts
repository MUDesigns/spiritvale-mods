import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { ensureSchema } from "@/db/migrate";
import { API_KEY_PREFIX, MAX_API_KEYS_PER_USER } from "@/lib/constants";

export type PublicApiKey = {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function hashKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function toPublic(row: {
  id: string;
  name: string;
  last4: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}): PublicApiKey {
  return {
    id: row.id,
    name: row.name,
    last4: row.last4,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export async function listApiKeys(userId: string): Promise<PublicApiKey[]> {
  await ensureSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(toPublic);
}

export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ key: string; record: PublicApiKey } | { error: string; status: number }> {
  await ensureSchema();
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  if (count >= MAX_API_KEYS_PER_USER) {
    return {
      error: `You can have at most ${MAX_API_KEYS_PER_USER} active API keys.`,
      status: 400,
    };
  }

  const token = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  const id = crypto.randomUUID();
  const label = name.trim().slice(0, 40) || "CLI key";
  await db.insert(apiKeys).values({
    id,
    userId,
    name: label,
    keyHash: hashKey(token),
    last4: token.slice(-4),
  });
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return {
    key: token,
    record: toPublic(row!),
  };
}

export async function revokeApiKey(
  userId: string,
  id: string,
): Promise<{ error: string; status: number } | { ok: true }> {
  await ensureSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(
      and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)),
    )
    .limit(1);
  if (!row) {
    return { error: "API key not found.", status: 404 };
  }
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id));
  return { ok: true };
}

export async function userIdFromApiKey(token: string): Promise<string | null> {
  if (!token.startsWith(API_KEY_PREFIX) || token.length < 20) return null;
  await ensureSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return row.userId;
}
