import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { publishEvents } from "@/db/schema";
import { ensureSchema } from "@/db/migrate";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export async function consumeUserRateLimit(userId: string): Promise<Response | null> {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const db = getDb();
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(publishEvents)
    .where(and(eq(publishEvents.userId, userId), gte(publishEvents.createdAt, cutoff)));
  if (count >= RATE_LIMIT_MAX) {
    return Response.json(
      { error: "Too many requests. Try again in a few seconds." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      },
    );
  }
  await db.insert(publishEvents).values({ userId });
  return null;
}
