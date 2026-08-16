import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { requirePublishToken } from "@/lib/auth";
import { sanitizePathname } from "@/lib/ids";

export const dynamic = "force-dynamic";

type UploadBody = {
  pathname?: string;
  contentType?: string;
};

export async function POST(request: Request) {
  const denied = requirePublishToken(request);
  if (denied) return denied;

  const body = (await request.json()) as UploadBody;
  const pathname = sanitizePathname(body.pathname ?? "");
  if (!pathname) {
    return Response.json(
      { error: "pathname must be mods/{id}/{version}/{filename} or app/{version}/{filename}." },
      { status: 400 },
    );
  }

  const contentType = body.contentType?.trim() || "application/octet-stream";
  const validUntil = Date.now() + 60 * 60 * 1000;
  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [
      contentType,
      "application/octet-stream",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-msdownload",
      "application/vnd.microsoft.portable-executable",
    ],
    addRandomSuffix: false,
    allowOverwrite: true,
    maximumSizeInBytes: 512 * 1024 * 1024,
    validUntil,
  });

  const uploadUrl = `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`;
  return Response.json({ clientToken, pathname, uploadUrl, validUntil });
}
