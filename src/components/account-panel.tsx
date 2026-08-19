"use client";

import { useClerk, useReverification, useUser } from "@clerk/nextjs";
import { type FormEvent, useEffect, useState } from "react";
import { clerkErrorText } from "@/lib/clerk-ui";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/clerk-options";
import { ApiKeysPanel } from "@/components/api-keys-panel";

const PROVIDERS = [
  { strategy: "oauth_google" as const, label: "Google" },
  { strategy: "oauth_discord" as const, label: "Discord" },
];

export function AccountPanel() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updatePassword = useReverification(
    (params: { currentPassword?: string; newPassword: string }) =>
      user?.updatePassword({
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
        signOutOfOtherSessions: true,
      }),
  );

  useEffect(() => {
    const connected = user?.externalAccounts.some(
      (account) =>
        (account.provider === "discord" || account.provider === "oauth_discord") &&
        account.verification?.status === "verified",
    );
    if (!connected) return;
    void fetch("/api/account/sync-discord", { method: "POST" });
  }, [user]);

  if (!isLoaded) {
    return <p className="text-sm text-[#9aa3b8]">Loading account…</p>;
  }
  if (!isSignedIn || !user) {
    return <p className="text-sm text-[#9aa3b8]">Sign in to manage your account.</p>;
  }

  const signedInUser = user;

  const savedName =
    typeof signedInUser.unsafeMetadata.displayName === "string"
      ? signedInUser.unsafeMetadata.displayName
      : "";

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const nextUsername = username.trim() || signedInUser.username || "";
      if (nextUsername && nextUsername !== signedInUser.username) {
        await signedInUser.update({ username: nextUsername });
      }
      await signedInUser.updateMetadata({
        unsafeMetadata: { displayName: displayName.trim() || savedName },
      });
      setMessage("Profile saved.");
    } catch (err) {
      setError(clerkErrorText(err) || "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updatePassword({
        currentPassword: signedInUser.passwordEnabled ? currentPassword : undefined,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (err) {
      setError(clerkErrorText(err) || "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  async function connect(strategy: "oauth_google" | "oauth_discord") {
    setBusy(true);
    setError(null);
    try {
      const account = await signedInUser.createExternalAccount({
        strategy,
        redirectUrl: "/sso-callback",
      });
      const url = account.verification?.externalVerificationRedirectURL;
      if (url) {
        window.location.href = url.href;
        return;
      }
      await signedInUser.reload();
    } catch (err) {
      setError(clerkErrorText(err) || "Could not connect account.");
      setBusy(false);
    }
  }

  async function disconnect(accountId: string) {
    const account = signedInUser.externalAccounts.find((item) => item.id === accountId);
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      await account.destroy();
      await signedInUser.reload();
      setMessage("Connection removed.");
    } catch (err) {
      setError(clerkErrorText(err) || "Could not remove connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-6">
        <h2 className="text-lg font-extrabold">Profile</h2>
        <p className="mt-1 text-sm text-[#9aa3b8]">
          {signedInUser.primaryEmailAddress?.emailAddress ?? "No email on this account"}
        </p>
        <form onSubmit={saveProfile} className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-extrabold">
            Username
            <input
              className="field mt-1"
              defaultValue={signedInUser.username ?? ""}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={USERNAME_MIN}
              maxLength={USERNAME_MAX}
              autoComplete="username"
              placeholder="Letters, numbers, and underscores"
            />
          </label>
          <label className="text-sm font-extrabold">
            Display name
            <input
              className="field mt-1"
              defaultValue={savedName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              placeholder="Shown on the catalog"
            />
          </label>
          <button type="submit" className="btn btn-primary self-start" disabled={busy}>
            Save profile
          </button>
        </form>
      </section>

      <ApiKeysPanel />

      <section className="panel p-6">
        <h2 className="text-lg font-extrabold">Password</h2>
        <form onSubmit={savePassword} className="mt-4 flex flex-col gap-3">
          {signedInUser.passwordEnabled ? (
            <label className="text-sm font-extrabold">
              Current password
              <input
                className="field mt-1"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
          ) : (
            <p className="text-sm text-[#9aa3b8]">
              Add a password so you can also sign in with email.
            </p>
          )}
          <label className="text-sm font-extrabold">
            New password
            <input
              className="field mt-1"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={15}
              required
              autoComplete="new-password"
            />
            <span className="mt-1 block text-xs font-semibold text-[#9aa3b8]">
              At least 15 characters.
            </span>
          </label>
          <button type="submit" className="btn btn-primary self-start" disabled={busy}>
            Update password
          </button>
        </form>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-extrabold">Connected accounts</h2>
        <p className="mt-1 text-sm text-[#9aa3b8]">
          Connect Discord to get the Verified Modder role after you publish a live
          mod.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {PROVIDERS.map((provider) => {
            const connected = signedInUser.externalAccounts.find(
              (account) =>
                account.provider === provider.strategy.replace("oauth_", "") &&
                account.verification?.status === "verified",
            );
            return (
              <li
                key={provider.strategy}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
              >
                <div>
                  <p className="font-extrabold">{provider.label}</p>
                  <p className="text-sm text-[#9aa3b8]">
                    {connected ? connected.emailAddress || "Connected" : "Not connected"}
                  </p>
                </div>
                {connected ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => disconnect(connected.id)}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => connect(provider.strategy)}
                  >
                    Connect
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error ? <p className="text-sm text-[#e07a6d]">{error}</p> : null}
      {message ? <p className="text-sm text-[#6ed6a0]">{message}</p> : null}

      <button
        type="button"
        className="btn btn-secondary self-start"
        onClick={() => signOut({ redirectUrl: "/" })}
      >
        Sign out
      </button>
    </div>
  );
}
