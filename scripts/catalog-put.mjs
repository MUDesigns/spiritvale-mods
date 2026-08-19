export async function catalogPutFile({
  catalogUrl,
  publishToken,
  pathname,
  body,
  contentType,
}) {
  const tokenResponse = await fetch(`${catalogUrl}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publishToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pathname, contentType }),
  });
  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    throw new Error(`Catalog upload token failed (${tokenResponse.status}): ${tokenText}`);
  }
  const token = JSON.parse(tokenText);
  if (!token.uploadUrl || !token.clientToken) {
    throw new Error("Catalog did not return an upload URL.");
  }
  const putResponse = await fetch(token.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token.clientToken}`,
      "Content-Type": contentType,
      "Content-Length": String(body.length),
    },
    body,
  });
  const putText = await putResponse.text();
  if (!putResponse.ok) {
    throw new Error(`Catalog upload failed (${putResponse.status}): ${putText}`);
  }
  const stored = JSON.parse(putText);
  return stored.downloadUrl || stored.url;
}
