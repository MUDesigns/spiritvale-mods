"use client";

import { useRef, useState } from "react";
import { putCatalogFile, requestCatalogUpload } from "@/lib/browser-upload";
import {
  IMAGE_MAX_BYTES,
  MAX_IMAGES_PER_MOD,
} from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { isImageFilename, safeFilename } from "@/lib/ids";
import type { CatalogModImage, ModImageList } from "@/lib/types";

export function ModImagesPanel({
  id,
  initial,
}: {
  id: string;
  initial: ModImageList;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyResult(response: Response) {
    const json = (await response.json()) as ModImageList & { error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? "Could not update screenshots.");
    }
    setList({
      thumbnailImageId: json.thumbnailImageId ?? null,
      images: json.images ?? [],
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES_PER_MOD - list.images.length;
    if (remaining <= 0) {
      setError(`A mod can have at most ${MAX_IMAGES_PER_MOD} screenshots.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let nextList = list;
      for (const file of Array.from(files).slice(0, remaining)) {
        const filename = safeFilename(file.name);
        if (!filename || !isImageFilename(filename)) {
          throw new Error("Screenshots must be PNG, JPEG, WebP, or GIF.");
        }
        if (file.size > IMAGE_MAX_BYTES) {
          throw new Error(`Each image must be ${formatBytes(IMAGE_MAX_BYTES)} or smaller.`);
        }
        const pathname = `mods/${id}/images/${crypto.randomUUID()}/${filename}`;
        const token = await requestCatalogUpload("/api/community/image-upload-token", {
          pathname,
          id,
          contentType: file.type || "application/octet-stream",
        });
        const blob = await putCatalogFile(token, file, file.type || "application/octet-stream");
        const response = await fetch(`/api/community/mods/${id}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pathname,
            filename,
            sizeBytes: file.size,
            downloadUrl: blob.downloadUrl || blob.url,
            url: blob.url,
            setThumbnail: nextList.images.length === 0 && !nextList.thumbnailImageId,
          }),
        });
        const json = (await response.json()) as ModImageList & { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "Could not save the screenshot.");
        }
        nextList = {
          thumbnailImageId: json.thumbnailImageId ?? null,
          images: json.images ?? [],
        };
        setList(nextList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload screenshot.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function setThumbnail(image: CatalogModImage) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/mods/${id}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailImageId: image.id }),
      });
      await applyResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set thumbnail.");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage(image: CatalogModImage) {
    if (!window.confirm("Remove this screenshot?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/mods/${id}/images/${image.id}`, {
        method: "DELETE",
      });
      await applyResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete screenshot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold">Screenshots</h3>
        <label className="btn btn-secondary btn-compact cursor-pointer">
          {busy ? "Working…" : "Add screenshots"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            multiple
            hidden
            disabled={busy || list.images.length >= MAX_IMAGES_PER_MOD}
            onChange={(event) => void onFiles(event.target.files)}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        PNG, JPEG, WebP, or GIF · {formatBytes(IMAGE_MAX_BYTES)} max ·{" "}
        {list.images.length}/{MAX_IMAGES_PER_MOD}. The thumbnail appears next to
        the title in the catalog.
      </p>
      {error ? <p className="mt-2 text-sm text-[#e07a6d]">{error}</p> : null}
      {list.images.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No screenshots yet.</p>
      ) : (
        <ul className="mod-image-editor mt-3">
          {list.images.map((image) => {
            const isThumb = image.id === list.thumbnailImageId;
            return (
              <li key={image.id} className={isThumb ? "is-thumb" : undefined}>
                <img src={image.url} alt="" />
                <div className="mod-image-editor-actions">
                  {isThumb ? (
                    <span className="mod-thumb-badge">Thumbnail</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      disabled={busy}
                      onClick={() => void setThumbnail(image)}
                    >
                      Use as thumbnail
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-compact"
                    disabled={busy}
                    onClick={() => void removeImage(image)}
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
  );
}
