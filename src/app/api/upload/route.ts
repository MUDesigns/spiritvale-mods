import { APP_MAX_BYTES } from "@/lib/constants";
import { requirePublishToken } from "@/lib/auth";
import { sanitizeStoredPathname } from "@/lib/ids";
import { issueUpload, requestOrigin } from "@/lib/upload-token";

export const dynamic = "force-dynamic";

type UploadBody = {
  pathname?: string;
  contentType?: string;
};

export async function POST(request: Request) {
  const denied = requirePublishToken(request);
  if (denied) return denied;

  const body = (await request.json()) as UploadBody;
  const pathname = sanitizeStoredPathname(body.pathname ?? "");
  if (!pathname || pathname.startsWith("quarantine/") || pathname === "catalog.json") {
    return Response.json(
      {
        error:
          "pathname must be mods/{id}/{version}/{filename}, mods/{id}/images/{uuid}/{filename}, or app/{version}/{filename}.",
      },
      { status: 400 },
    );
  }

  return Response.json(
    issueUpload({
      pathname,
      maxBytes: APP_MAX_BYTES,
      origin: requestOrigin(request),
    }),
  );
}
