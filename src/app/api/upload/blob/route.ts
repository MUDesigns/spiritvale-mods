import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { bearerToken } from "@/lib/auth";
import { sanitizeStoredPathname } from "@/lib/ids";
import { writeStoredStream } from "@/lib/store";
import { verifyUploadToken } from "@/lib/upload-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function requestStream(request: Request): AsyncIterable<Uint8Array> {
  if (!request.body) {
    throw new Error("Empty upload body.");
  }
  return Readable.fromWeb(request.body as NodeWebReadableStream<Uint8Array>);
}

export async function PUT(request: Request) {
  try {
    const token = verifyUploadToken(bearerToken(request));
    const requested = new URL(request.url).searchParams.get("pathname") ?? token.pathname;
    const pathname = sanitizeStoredPathname(requested);
    if (!pathname || pathname !== token.pathname) {
      return Response.json({ error: "Upload path does not match token." }, { status: 403 });
    }
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length && length > token.maxBytes) {
      return Response.json(
        { error: `Upload exceeds ${token.maxBytes} bytes.` },
        { status: 413 },
      );
    }
    const stored = await writeStoredStream(pathname, requestStream(request), token.maxBytes);
    return Response.json(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status =
      message.includes("expired") || message.includes("Invalid upload token")
        ? 401
        : message.includes("exceeds")
          ? 413
          : 400;
    return Response.json({ error: message }, { status });
  }
}
