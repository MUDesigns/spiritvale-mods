export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export function requirePublishToken(request: Request): Response | null {
  const expected = process.env.PUBLISH_TOKEN?.trim();
  if (!expected) {
    return Response.json(
      { error: "PUBLISH_TOKEN is not configured on the catalog server." },
      { status: 500 },
    );
  }
  const token = bearerToken(request);
  if (!token || token !== expected) {
    return unauthorized();
  }
  return null;
}
