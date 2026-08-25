"use client";

import { useEffect, useState } from "react";

const DEVKIT_URL = "https://github.com/MUDesigns/spiritvale-mod-devkit";

type ApiKeyRow = {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function mask(last4: string): string {
  return `svm_••••${last4}`;
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/account/api-keys");
    const json = (await response.json()) as { keys?: ApiKeyRow[]; error?: string };
    if (!response.ok) {
      setError(json.error ?? "Could not load API keys.");
      return;
    }
    setKeys(json.keys ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = (await response.json()) as ApiKeyRow & {
        key?: string;
        error?: string;
      };
      if (!response.ok || !json.key) {
        throw new Error(json.error ?? "Could not create API key.");
      }
      setCreatedKey(json.key);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create API key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/account/api-keys/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not revoke key.");
      }
      if (createdKey?.endsWith(keys.find((row) => row.id === id)?.last4 ?? "----")) {
        setCreatedKey(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke key.");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  }

  return (
    <section className="panel p-6">
      <h2 className="text-lg font-extrabold">API keys</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Use a key to upload mods from CI or local scripts. Treat it like a password.
        Docs and a Node example:{" "}
        <a href={DEVKIT_URL} className="font-bold text-[var(--blue)] hover:underline">
          spiritvale-mod-devkit
        </a>
        .
      </p>

      {createdKey ? (
        <div className="mt-4 rounded-xl border border-[var(--blue)]/40 bg-[var(--bg1-solid)] p-4">
          <p className="text-sm font-extrabold text-[#6ed6a0]">Copy this key now. It is shown once.</p>
          <code className="mt-2 block break-all font-mono text-sm text-[#f4f7fb]">{createdKey}</code>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => void copyKey()}>
            {copied ? "Copied" : "Copy key"}
          </button>
        </div>
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {keys.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No active keys.</li>
        ) : (
          keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
            >
              <div>
                <p className="font-extrabold">{key.name}</p>
                <p className="font-mono text-sm text-[var(--muted)]">{mask(key.last4)}</p>
                <p className="text-xs text-[var(--muted)]">
                  Created {new Date(key.createdAt).toLocaleString()}
                  {key.lastUsedAt
                    ? ` · Last used ${new Date(key.lastUsedAt).toLocaleString()}`
                    : " · Never used"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void revoke(key.id)}
              >
                Revoke
              </button>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={(event) => void createKey(event)} className="mt-4 flex flex-col gap-3">
        <label className="text-sm font-extrabold">
          Key name
          <input
            className="field mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder="CI, laptop, …"
          />
        </label>
        <button type="submit" className="btn btn-primary self-start" disabled={busy}>
          Generate API key
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-[#e07a6d]">{error}</p> : null}
    </section>
  );
}
