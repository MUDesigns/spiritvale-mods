import postgres from "postgres";

export function openSql(url = process.env.DATABASE_URL) {
  const connection = url?.trim();
  if (!connection) {
    throw new Error("DATABASE_URL is required.");
  }
  return postgres(connection, { max: 1 });
}
