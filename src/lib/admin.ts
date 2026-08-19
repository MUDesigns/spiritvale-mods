import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { catalogAdmins } from "@/db/schema";
import { ensureSchema } from "@/db/migrate";
import { hasClerk } from "@/lib/clerk";
import {
  ADMIN_ALERT_EMAIL,
  DEFAULT_ADMIN_EMAIL,
} from "@/lib/constants";

type ClerkEmail = {
  id?: string;
  emailAddress?: string;
  verification?: { status?: string | null } | null;
};

type ClerkUserLike = {
  id?: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmail[];
} | null;

export type GrantedAdmin = {
  email: string;
  grantedByUserId: string;
  createdAt: string;
};

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function parseEmailList(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeAdminEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function builtinAdminEmails(): Set<string> {
  return new Set([
    DEFAULT_ADMIN_EMAIL,
    ADMIN_ALERT_EMAIL.toLowerCase(),
    ...parseEmailList(process.env.ADMIN_EMAILS ?? ""),
  ]);
}

export function adminEmails(): Set<string> {
  return builtinAdminEmails();
}

function userMatchesAdmins(user: ClerkUserLike, admins: Set<string>): boolean {
  if (!user?.emailAddresses?.length) return false;
  return user.emailAddresses.some((entry) => {
    const email = entry.emailAddress?.trim().toLowerCase();
    if (!email || !admins.has(email)) return false;
    const verified = entry.verification?.status === "verified";
    const primary = Boolean(user.primaryEmailAddressId) && entry.id === user.primaryEmailAddressId;
    return verified || primary;
  });
}

export function clerkUserIsAdmin(user: ClerkUserLike, extraEmails: Iterable<string> = []): boolean {
  const admins = new Set(builtinAdminEmails());
  for (const email of extraEmails) admins.add(email);
  return userMatchesAdmins(user, admins);
}

async function grantedAdminEmails(): Promise<string[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureSchema();
    const rows = await getDb().select({ email: catalogAdmins.email }).from(catalogAdmins);
    return rows.map((row) => row.email);
  } catch {
    return [];
  }
}

async function allAdminEmails(): Promise<Set<string>> {
  const emails = builtinAdminEmails();
  for (const email of await grantedAdminEmails()) emails.add(email);
  return emails;
}

export async function isCatalogAdmin(userId: string): Promise<boolean> {
  if (!userId || !hasClerk()) return false;
  try {
    const admins = await allAdminEmails();
    const sessionUser = await currentUser();
    if (sessionUser?.id === userId) return userMatchesAdmins(sessionUser, admins);
    const client = await clerkClient();
    return userMatchesAdmins(await client.users.getUser(userId), admins);
  } catch {
    return false;
  }
}

export async function clerkUserIdForEmail(emailValue: string): Promise<string | null> {
  const email = normalizeAdminEmail(emailValue);
  if (!email || !hasClerk()) return null;
  try {
    const client = await clerkClient();
    const list = await client.users.getUserList({ emailAddress: [email], limit: 2 });
    const rows = "data" in list ? list.data : list;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function currentIsAdmin(): Promise<boolean> {
  if (!hasClerk()) return false;
  try {
    return userMatchesAdmins(await currentUser(), await allAdminEmails());
  } catch {
    return false;
  }
}

export async function listCatalogAdmins(): Promise<{
  builtins: string[];
  granted: GrantedAdmin[];
}> {
  const builtins = [...builtinAdminEmails()].sort();
  if (!hasDatabase()) return { builtins, granted: [] };
  await ensureSchema();
  const rows = await getDb()
    .select()
    .from(catalogAdmins);
  const granted = rows
    .filter((row) => !builtins.includes(row.email))
    .map((row) => ({
      email: row.email,
      grantedByUserId: row.grantedByUserId,
      createdAt: row.createdAt.toISOString(),
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
  return { builtins, granted };
}

export async function grantCatalogAdmin(
  emailValue: string,
  grantedByUserId: string,
): Promise<{ ok: true; email: string } | { error: string; status: number }> {
  const email = normalizeAdminEmail(emailValue);
  if (!email) return { error: "Enter a valid email address.", status: 400 };
  if ((await allAdminEmails()).has(email)) {
    return { error: "That email is already an admin.", status: 409 };
  }
  if (!hasDatabase()) {
    return { error: "Database is not configured.", status: 503 };
  }
  await ensureSchema();
  await getDb().insert(catalogAdmins).values({
    email,
    grantedByUserId,
  });
  return { ok: true, email };
}

export async function revokeCatalogAdmin(
  emailValue: string,
  actorEmails: string[],
): Promise<{ ok: true } | { error: string; status: number }> {
  const email = normalizeAdminEmail(emailValue);
  if (!email) return { error: "Enter a valid email address.", status: 400 };
  if (builtinAdminEmails().has(email)) {
    return { error: "That admin is built into the catalog and cannot be removed.", status: 400 };
  }
  const actor = new Set(actorEmails.map((item) => item.trim().toLowerCase()));
  if (actor.has(email)) {
    return { error: "You cannot remove your own admin access.", status: 400 };
  }
  if (!hasDatabase()) {
    return { error: "Database is not configured.", status: 503 };
  }
  await ensureSchema();
  const deleted = await getDb()
    .delete(catalogAdmins)
    .where(eq(catalogAdmins.email, email))
    .returning({ email: catalogAdmins.email });
  if (deleted.length === 0) return { error: "Admin not found.", status: 404 };
  return { ok: true };
}
