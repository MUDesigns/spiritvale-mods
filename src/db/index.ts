import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const globalForPg = globalThis as unknown as {
  __spiritvaleSql?: ReturnType<typeof postgres>;
};

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function createSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!globalForPg.__spiritvaleSql) {
    globalForPg.__spiritvaleSql = postgres(url, {
      max: 4,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalForPg.__spiritvaleSql;
}

export function getSql() {
  return createSql();
}

export function getDb() {
  return drizzle(createSql(), { schema });
}
