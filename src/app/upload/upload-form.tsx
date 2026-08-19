"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { putCatalogFile, requestCatalogUpload } from "@/lib/browser-upload";
import { COMMUNITY_MAX_BYTES, DESCRIPTION_MAX } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function UploadForm() {
  const { user } = useUser();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const id = String(data.get("id") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    const version = String(data.get("version") ?? "").trim();
    const changelog = String(data.get("changelog") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a .zip file.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip uploads are allowed.");
      return;
    }
    if (file.size > COMMUNITY_MAX_BYTES) {
      setError(`Zip must be ${formatBytes(COMMUNITY_MAX_BYTES)} or smaller.`);
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Hashing and uploading…");
    try {
      const sha256 = await sha256File(file);
      const pathname = `quarantine/${user.id}/${crypto.randomUUID()}/${file.name}`;
      const token = await requestCatalogUpload("/api/community/upload-token", {
        pathname,
        id,
        version,
        contentType: file.type || "application/zip",
      });
      const blob = await putCatalogFile(token, file, file.type || "application/zip");
      setStatus("Queued for virus scan…");
      const response = await fetch("/api/community/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          version,
          changelog,
          description,
          pathname,
          filename: file.name,
          sha256,
          sizeBytes: file.size,
          downloadUrl: blob.downloadUrl || blob.url,
        }),
      });
      const json = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Publish failed.");
      }
      setStatus(json.message ?? "Scanning. Check My mods for status.");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Display name
        <input required name="name" className="field" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Catalog id
        <input
          required
          name="id"
          pattern="[a-z0-9][a-z0-9-]{0,127}"
          placeholder="my-cool-mod"
          className="field"
        />
        <span className="text-xs font-semibold text-[#9aa3b8]">
          Lowercase letters, numbers, and hyphens. This is permanent for your mod.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Version
        <input required name="version" defaultValue="1.0.0" className="field" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Description
        <textarea
          name="description"
          rows={5}
          maxLength={DESCRIPTION_MAX}
          placeholder="What this mod does, like a Nexus description."
          className="field"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Changelog
        <textarea name="changelog" rows={3} className="field" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Zip file (max {formatBytes(COMMUNITY_MAX_BYTES)})
        <input required name="file" type="file" accept=".zip,application/zip" className="field" />
      </label>
      <p className="text-xs font-semibold text-[#9aa3b8]">
        Files are scanned with VirusTotal before they appear in the catalog. A
        clean result publishes automatically. Detections, scan errors, or unsafe
        zips stay quarantined. Scanning is best-effort and not a substitute for
        desktop antivirus.
      </p>
      {error ? <p className="text-sm text-[#e07a6d]">{error}</p> : null}
      {status ? <p className="text-sm text-[#55b7ea]">{status}</p> : null}
      <button
        type="submit"
        disabled={busy || !user}
        className="btn btn-primary self-start"
      >
        {busy ? "Uploading…" : "Upload and scan"}
      </button>
    </form>
  );
}
