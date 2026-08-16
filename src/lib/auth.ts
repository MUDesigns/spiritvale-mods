export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function requirePublishToken(request: Request): Response | null {
  const expected = process.env.PUBLISH_TOKEN?.trim();
  if (!expected) {
    return Response.json(
      { error: "PUBLISH_TOKEN is not configured on the catalog server." },
      { status: 500 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token || token !== expected) {
    return unauthorized();
  }
  return null;
}
