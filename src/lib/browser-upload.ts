import { IMAGE_MAX_BYTES } from "@/lib/constants";
import { isImageFilename, safeFilename } from "@/lib/ids";
import type { ModImageList } from "@/lib/types";

export type CatalogUploadToken = {
  pathname: string;
  clientToken: string;
  uploadUrl: string;
};

export async function requestCatalogUpload(
  tokenUrl: string,
  body: Record<string, unknown>,
): Promise<CatalogUploadToken> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") || 5);
      await new Promise((resolve) =>
        setTimeout(resolve, (Number.isFinite(retryAfter) ? retryAfter : 5) * 1000),
      );
      continue;
    }
    const json = (await response.json()) as CatalogUploadToken & { error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? "Could not start upload.");
    }
    if (!json.clientToken || !json.uploadUrl || !json.pathname) {
      throw new Error("Catalog did not return an upload URL.");
    }
    return json;
  }
  throw new Error("Could not start upload.");
}

export async function putCatalogFile(
  token: CatalogUploadToken,
  file: Blob,
  contentType: string,
): Promise<{ url: string; downloadUrl: string; pathname: string }> {
  const response = await fetch(token.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token.clientToken}`,
      "Content-Type": contentType,
    },
    body: file,
  });
  const json = (await response.json()) as {
    error?: string;
    url?: string;
    downloadUrl?: string;
    pathname?: string;
  };
  if (!response.ok) {
    throw new Error(json.error ?? "Upload failed.");
  }
  const url = json.downloadUrl || json.url;
  if (!url) {
    throw new Error("Catalog did not return a file URL.");
  }
  return {
    url: json.url || url,
    downloadUrl: url,
    pathname: json.pathname || token.pathname,
  };
}

export async function uploadModScreenshot(
  id: string,
  file: File,
  options?: { setThumbnail?: boolean },
): Promise<ModImageList> {
  const filename = safeFilename(file.name);
  if (!filename || !isImageFilename(filename)) {
    throw new Error("Screenshots must be PNG, JPEG, WebP, or GIF.");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(`Each image must be ${IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`);
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
      setThumbnail: Boolean(options?.setThumbnail),
    }),
  });
  const json = (await response.json()) as ModImageList & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Could not save the screenshot.");
  }
  return {
    thumbnailImageId: json.thumbnailImageId ?? null,
    images: json.images ?? [],
  };
}
