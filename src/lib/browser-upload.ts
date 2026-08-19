export type CatalogUploadToken = {
  pathname: string;
  clientToken: string;
  uploadUrl: string;
};

export async function requestCatalogUpload(
  tokenUrl: string,
  body: Record<string, unknown>,
): Promise<CatalogUploadToken> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as CatalogUploadToken & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Could not start upload.");
  }
  if (!json.clientToken || !json.uploadUrl || !json.pathname) {
    throw new Error("Catalog did not return an upload URL.");
  }
  return json;
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
