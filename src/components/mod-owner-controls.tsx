"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function deleteResource(url: string): Promise<void> {
  const response = await fetch(url, { method: "DELETE" });
  const json = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(json.error ?? "Could not delete.");
}

export function DeleteModButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const confirmed = window.confirm(
      `Permanently delete "${name}" and every uploaded file? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await deleteResource(`/api/community/mods/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this mod.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={() => void onDelete()}
      >
        {busy ? "Deleting…" : "Delete mod"}
      </button>
      {error ? <p className="text-xs text-[#e07a6d]">{error}</p> : null}
    </div>
  );
}

export function DeleteVersionButton({
  id,
  version,
  filename,
  isLatestLive,
  remainingCount,
}: {
  id: string;
  version: string;
  filename: string;
  isLatestLive: boolean;
  remainingCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const notes: string[] = [];
    if (isLatestLive && remainingCount > 1) {
      notes.push("This is the current catalog file. The next older live version will become current.");
    }
    if (remainingCount <= 1) {
      notes.push("This is the last uploaded file. The listing will have no downloads until you upload again.");
    }
    const confirmed = window.confirm(
      [`Delete v${version} (${filename})?`, ...notes].join("\n\n"),
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await deleteResource(
        `/api/community/mods/${id}/versions/${encodeURIComponent(version)}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this file.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={() => void onDelete()}
      >
        {busy ? "Deleting…" : "Delete file"}
      </button>
      {error ? <p className="text-xs text-[#e07a6d]">{error}</p> : null}
    </div>
  );
}

export function ApproveVersionButton({
  id,
  version,
  filename,
  scanSummary,
}: {
  id: string;
  version: string;
  filename: string;
  scanSummary?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onApprove() {
    const extra = scanSummary
      ? `\n\nScan note:\n${scanSummary}`
      : "";
    const confirmed = window.confirm(
      `Approve v${version} (${filename}) and list it on the catalog? This bypasses the virus scan queue.${extra}`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/community/mods/${id}/versions/${encodeURIComponent(version)}/approve`,
        { method: "POST" },
      );
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not approve.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this file.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void onApprove()}
      >
        {busy ? "Approving…" : "Approve"}
      </button>
      {error ? <p className="text-xs text-[#e07a6d]">{error}</p> : null}
    </div>
  );
}

export function HideModButton({
  id,
  name,
  hidden,
}: {
  id: string;
  name: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    const nextHidden = !hidden;
    const confirmed = window.confirm(
      nextHidden
        ? `Hide "${name}" from the public catalog? You and admins can still see it here and unhide it later.`
        : `Show "${name}" on the public catalog again?`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/mods/${id}/visibility`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: nextHidden }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not update visibility.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update visibility.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => void onToggle()}
      >
        {busy ? "Saving…" : hidden ? "Unhide" : "Hide from catalog"}
      </button>
      {error ? <p className="text-xs text-[#e07a6d]">{error}</p> : null}
    </div>
  );
}

export function RetryScanButton({
  id,
  version,
}: {
  id: string;
  version: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRetry() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/community/mods/${id}/versions/${encodeURIComponent(version)}/rescan`,
        { method: "POST" },
      );
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not retry scan.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retry scan.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => void onRetry()}
      >
        {busy ? "Queueing…" : "Retry scan"}
      </button>
      {error ? <p className="text-xs text-[#e07a6d]">{error}</p> : null}
    </div>
  );
}
