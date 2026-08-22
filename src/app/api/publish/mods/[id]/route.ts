import { requirePublishToken } from "@/lib/auth";
import { updateModDescriptionAsPublisher, writeResultResponse } from "@/lib/catalog";
import { DESCRIPTION_MAX } from "@/lib/constants";
import { isCatalogId, sanitizeDescription } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * Trusted publisher: update mod name/description without a new version upload.
 * Does not notify Discord.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = requirePublishToken(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!isCatalogId(id)) {
    return Response.json({ error: "Invalid mod id." }, { status: 400 });
  }

  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();
  const description =
    body.description === undefined ? undefined : sanitizeDescription(body.description);
  if (body.description !== undefined && description === undefined) {
    return Response.json(
      { error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` },
      { status: 400 },
    );
  }
  if (name === undefined && description === undefined) {
    return Response.json(
      { error: "Provide name and/or description." },
      { status: 400 },
    );
  }

  return writeResultResponse(
    await updateModDescriptionAsPublisher(id, {
      name: name || undefined,
      description,
    }),
  );
}
