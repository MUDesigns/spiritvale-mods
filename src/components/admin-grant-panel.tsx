"use client";

import { useEffect, useState } from "react";

type GrantedAdmin = {
  email: string;
  grantedByUserId: string;
  createdAt: string;
};

export function AdminGrantPanel() {
  const [builtins, setBuiltins] = useState<string[]>([]);
  const [granted, setGranted] = useState<GrantedAdmin[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/admins");
    const json = (await response.json()) as {
      builtins?: string[];
      granted?: GrantedAdmin[];
      error?: string;
    };
    if (!response.ok) {
      setError(json.error ?? "Could not load admins.");
      return;
    }
    setBuiltins(json.builtins ?? []);
    setGranted(json.granted ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await response.json()) as { error?: string; email?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not grant admin.");
      setEmail("");
      setStatus(`Granted admin to ${json.email}. They need a catalog account with that email.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant admin.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(target: string) {
    const confirmed = window.confirm(`Remove admin access for ${target}?`);
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/admin/admins?email=${encodeURIComponent(target)}`,
        { method: "DELETE" },
      );
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not remove admin.");
      setStatus(`Removed ${target}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove admin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-6">
      <h2 className="text-lg font-extrabold">Catalog admins</h2>
      <p className="mt-1 text-sm text-[#9aa3b8]">
        Anyone listed here can moderate every listing and approve quarantined
        uploads. Grant access by the email on their SpiritVale Mods account.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {builtins.map((item) => (
          <li
            key={item}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
          >
            <div>
              <p className="font-extrabold">{item}</p>
              <p className="text-xs text-[#9aa3b8]">Built-in admin</p>
            </div>
          </li>
        ))}
        {granted.map((row) => (
          <li
            key={row.email}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
          >
            <div>
              <p className="font-extrabold">{row.email}</p>
              <p className="text-xs text-[#9aa3b8]">Granted admin</p>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => void revoke(row.email)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={(event) => void grant(event)} className="mt-4 flex flex-col gap-3">
        <label className="text-sm font-extrabold">
          Grant admin by email
          <input
            className="field mt-1"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary self-start" disabled={busy}>
          {busy ? "Saving…" : "Grant admin"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-[#e07a6d]">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-[#6ed6a0]">{status}</p> : null}
    </section>
  );
}
