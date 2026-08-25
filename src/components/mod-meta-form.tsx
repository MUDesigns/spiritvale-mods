"use client";

import { type FormEvent, useState } from "react";
import { DESCRIPTION_MAX } from "@/lib/constants";

export function ModMetaForm({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description: string;
}) {
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/community/mods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          description: nextDescription,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save.");
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <label className="text-sm font-extrabold">
        Display name
        <input
          className="field mt-1"
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          required
        />
      </label>
      <label className="text-sm font-extrabold">
        Description
        <textarea
                        className="field mt-1 min-h-[8rem]"
          value={nextDescription}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => setNextDescription(event.target.value)}
          placeholder="What this mod does, like on Nexus."
        />
        <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
          {nextDescription.length}/{DESCRIPTION_MAX}
        </span>
      </label>
      {error ? <p className="text-sm text-[#e07a6d]">{error}</p> : null}
      {status ? <p className="text-sm text-[#6ed6a0]">{status}</p> : null}
      <button type="submit" className="btn btn-primary self-start" disabled={busy}>
        {busy ? "Saving…" : "Save description"}
      </button>
    </form>
  );
}
