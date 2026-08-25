"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import {
  putCatalogFile,
  requestCatalogUpload,
  uploadModScreenshot,
} from "@/lib/browser-upload";
import {
  COMMUNITY_MAX_BYTES,
  DESCRIPTION_MAX,
  IMAGE_MAX_BYTES,
  MAX_IMAGES_PER_MOD,
} from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { isImageFilename, safeFilename } from "@/lib/ids";

type PendingShot = {
  key: string;
  file: File;
  previewUrl: string;
};

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function revokeShots(shots: PendingShot[]) {
  for (const shot of shots) URL.revokeObjectURL(shot.previewUrl);
}

export function UploadForm({ discordInvite }: { discordInvite: string }) {
  const { user } = useUser();
  const shotInputRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<PendingShot[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<PendingShot[]>([]);
  const [thumbKey, setThumbKey] = useState<string | null>(null);

  shotsRef.current = shots;

  useEffect(() => {
    return () => revokeShots(shotsRef.current);
  }, []);

  function clearShots() {
    revokeShots(shotsRef.current);
    shotsRef.current = [];
    setShots([]);
    setThumbKey(null);
    if (shotInputRef.current) shotInputRef.current.value = "";
  }

  function addShots(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES_PER_MOD - shots.length;
    if (remaining <= 0) {
      setError(`A mod can have at most ${MAX_IMAGES_PER_MOD} screenshots.`);
      return;
    }

    const added: PendingShot[] = [];
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const filename = safeFilename(file.name);
        if (!filename || !isImageFilename(filename)) {
          throw new Error("Screenshots must be PNG, JPEG, WebP, or GIF.");
        }
        if (file.size > IMAGE_MAX_BYTES) {
          throw new Error(`Each image must be ${formatBytes(IMAGE_MAX_BYTES)} or smaller.`);
        }
        added.push({
          key: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    } catch (err) {
      revokeShots(added);
      setError(err instanceof Error ? err.message : "Could not add screenshot.");
      return;
    }

    setError(null);
    setShots((current) => [...current, ...added]);
    setThumbKey((current) => current ?? added[0]?.key ?? null);
    if (shotInputRef.current) shotInputRef.current.value = "";
  }

  function removeShot(key: string) {
    const next = shots.filter((shot) => shot.key !== key);
    const removed = shots.find((shot) => shot.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    setShots(next);
    setThumbKey((current) => (current === key ? next[0]?.key ?? null : current));
  }

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

    const pendingShots = shots;
    const pendingThumb = thumbKey;

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

      let imageError: string | null = null;
      if (pendingShots.length > 0) {
        try {
          const ordered = pendingThumb
            ? [
                ...pendingShots.filter((shot) => shot.key === pendingThumb),
                ...pendingShots.filter((shot) => shot.key !== pendingThumb),
              ]
            : pendingShots;
          for (const [index, shot] of ordered.entries()) {
            setStatus(`Uploading screenshot ${index + 1} of ${ordered.length}…`);
            await uploadModScreenshot(id, shot.file, { setThumbnail: index === 0 });
          }
        } catch (err) {
          imageError =
            err instanceof Error ? err.message : "Could not save screenshots.";
        }
      }

      setStatus(
        `${json.message ?? "Scanning. Check My mods for status."} Join Discord for release pings: ${discordInvite}`,
      );
      if (imageError) {
        setError(
          `The zip is queued, but screenshots failed: ${imageError} Add them from My Uploads.`,
        );
      }
      form.reset();
      clearShots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const shotPicker = (
    <input
      ref={shotInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
      multiple
      hidden
      disabled={busy || shots.length >= MAX_IMAGES_PER_MOD}
      onChange={(event) => addShots(event.target.files)}
    />
  );

  return (
    <form onSubmit={onSubmit} className="upload-form">
      <div className="upload-grid">
        <div className="upload-col flex flex-col gap-4">
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
            <span className="text-xs font-semibold text-[var(--muted)]">
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
        </div>

        <div className="upload-col flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold">Screenshots</h2>
            {shots.length > 0 ? (
              <label className="btn btn-secondary btn-compact cursor-pointer">
                {busy ? "Working…" : "Add screenshots"}
                {shotPicker}
              </label>
            ) : null}
          </div>
          <p className="text-xs font-semibold text-[var(--muted)]">
            PNG, JPEG, WebP, or GIF · {formatBytes(IMAGE_MAX_BYTES)} max ·{" "}
            {shots.length}/{MAX_IMAGES_PER_MOD}. Pick a thumbnail for the catalog
            card.
          </p>
          {shots.length === 0 ? (
            <label className="upload-shots-drop">
              <span className="text-sm font-extrabold">Add screenshots</span>
              <span className="text-xs font-semibold text-[var(--muted)]">
                Optional. The first image is used as the thumbnail unless you pick
                another.
              </span>
              {shotPicker}
            </label>
          ) : (
            <ul className="mod-image-editor">
              {shots.map((shot) => {
                const isThumb = shot.key === thumbKey;
                return (
                  <li key={shot.key} className={isThumb ? "is-thumb" : undefined}>
                    <img src={shot.previewUrl} alt="" />
                    <div className="mod-image-editor-actions">
                      {isThumb ? (
                        <span className="mod-thumb-badge">Thumbnail</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          disabled={busy}
                          onClick={() => setThumbKey(shot.key)}
                        >
                          Use as thumbnail
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-compact"
                        disabled={busy}
                        onClick={() => removeShot(shot.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="text-xs font-semibold text-[var(--muted)]">
        Files are scanned with VirusTotal before they appear in the catalog. A
        clean result publishes automatically and is posted to{" "}
        <a href={discordInvite} className="font-bold text-[var(--blue)] hover:underline">
          Discord
        </a>
        . Detections, scan errors, or unsafe zips stay quarantined. Scanning is
        best-effort and not a substitute for desktop antivirus.
      </p>
      {error ? <p className="text-sm text-[#e07a6d]">{error}</p> : null}
      {status ? <p className="text-sm text-[var(--blue)]">{status}</p> : null}
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
