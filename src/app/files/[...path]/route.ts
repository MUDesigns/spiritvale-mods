import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeFor, publicDiskPath } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fileResponse(pathParts: string[], download: boolean) {
  const pathname = pathParts.map((part) => decodeURIComponent(part)).join("/");
  const diskPath = publicDiskPath(pathname);
  if (!diskPath) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const info = await stat(diskPath);
    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }
    const filename = pathname.split("/").pop() ?? "download";
    const headers = new Headers({
      "Content-Type": contentTypeFor(pathname),
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    });
    const stream = Readable.toWeb(createReadStream(diskPath)) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const download = new URL(request.url).searchParams.get("download") === "1";
  return fileResponse(path, download);
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const pathname = path.map((part) => decodeURIComponent(part)).join("/");
  const diskPath = publicDiskPath(pathname);
  if (!diskPath) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const info = await stat(diskPath);
    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(null, {
      headers: {
        "Content-Type": contentTypeFor(pathname),
        "Content-Length": String(info.size),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
