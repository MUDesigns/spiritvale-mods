import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const EMAIL = "matt03803@gmail.com";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

loadEnvLocal();

const secret = process.env.CLERK_SECRET_KEY?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!secret || !databaseUrl) {
  throw new Error("CLERK_SECRET_KEY and DATABASE_URL are required.");
}

const usersUrl = new URL("https://api.clerk.com/v1/users");
usersUrl.searchParams.set("email_address", EMAIL);
usersUrl.searchParams.set("limit", "5");
const response = await fetch(usersUrl, {
  headers: { Authorization: `Bearer ${secret}` },
});
if (!response.ok) {
  throw new Error(`Clerk lookup failed (${response.status})`);
}
const users = await response.json();
if (!Array.isArray(users) || users.length === 0) {
  throw new Error(
    `${EMAIL} does not have a Clerk account yet. Sign in with Google using that email first.`,
  );
}

const user = users.find((entry) =>
  (entry.email_addresses ?? []).some(
    (item) =>
      String(item.email_address ?? "").toLowerCase() === EMAIL &&
      item.verification?.status === "verified",
  ),
) ?? users[0];

const google = (user.external_accounts ?? []).some(
  (account) =>
    String(account.provider ?? "").includes("google") ||
    String(account.object ?? "").includes("google"),
);
if (!google) {
  console.warn("Clerk user found, but Google is not among connected accounts.");
}

const userId = user.id;
if (!userId) {
  throw new Error("Clerk user is missing an id.");
}

const sql = neon(databaseUrl);
const owned = await sql`
  UPDATE mods
  SET owner_user_id = ${userId}, updated_at = now()
  WHERE owner_user_id IS NULL
  RETURNING id
`;
if (owned.length > 0) {
  const ids = owned.map((row) => row.id);
  await sql`
    UPDATE mod_versions
    SET uploader_user_id = ${userId}
    WHERE uploader_user_id IS NULL
      AND mod_id IN (${ids})
  `;
}

console.log(
  `attributed ${owned.length} mods to ${EMAIL}${google ? " (Google)" : ""}: ${
    owned.map((row) => row.id).join(", ") || "(none)"
  }`,
);
