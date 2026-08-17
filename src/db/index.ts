import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function createDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return drizzle(neon(url), { schema });
}

export function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(url);
}

export function getDb() {
  return createDb();
}
