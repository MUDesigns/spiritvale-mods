import { clerkIdentity } from "@/lib/authors";

export type DiscordBridgeEvent = {
  type: "scan.queued" | "scan.quarantined" | "mod.live" | "app.live" | "modder.verified";
  modId?: string;
  version?: string;
  name?: string;
  reason?: string;
  discordUserId?: string | null;
};

function botUrl(): string | null {
  const url = process.env.DISCORD_BOT_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function botSecret(): string | null {
  return process.env.DISCORD_BOT_SECRET?.trim() || null;
}

export async function notifyDiscord(event: DiscordBridgeEvent): Promise<void> {
  const url = botUrl();
  const secret = botSecret();
  if (!url || !secret) return;
  try {
    await fetch(`${url}/internal/event`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Bot downtime must not fail uploads or scans.
  }
}

export async function notifyModLive(input: {
  modId: string;
  version?: string;
  name?: string;
  ownerUserId?: string | null;
}): Promise<void> {
  const identity = input.ownerUserId ? await clerkIdentity(input.ownerUserId) : null;
  await notifyDiscord({
    type: "mod.live",
    modId: input.modId,
    version: input.version,
    name: input.name ?? identity?.name,
    discordUserId: identity?.discordUserId,
  });
}

export async function notifyVerifiedModder(userId: string): Promise<void> {
  const identity = await clerkIdentity(userId);
  if (!identity?.discordUserId) return;
  const { hasDatabase, listUserMods } = await import("@/lib/catalog");
  if (!hasDatabase()) return;
  const { versions } = await listUserMods(userId);
  if (!versions.some((row) => row.status === "live")) return;
  await notifyDiscord({ type: "modder.verified", discordUserId: identity.discordUserId });
}
