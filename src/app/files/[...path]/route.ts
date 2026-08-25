import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { auth } from "@clerk/nextjs/server";
import { isCatalogAdmin } from "@/lib/admin";
import { getModOwner, isModHidden } from "@/lib/catalog";
import { catalogPausedResponse, isCatalogPaused } from "@/lib/catalog-pause";
import { isCatalogId } from "@/lib/ids";
import { contentTypeFor, publicDiskPath } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isModZipPath(pathname: string): boolean {
  return pathname.startsWith("mods/") && pathname.toLowerCase().endsWith(".zip");
}

function modIdFromStoredPath(pathname: string): string | null {
  if (!pathname.startsWith("mods/")) return null;
  const id = pathname.split("/")[1] ?? "";
  return isCatalogId(id) ? id : null;
}

async function canAccessHiddenMod(modId: string): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  if (await isCatalogAdmin(userId)) return true;
  const owner = await getModOwner(modId);
  return owner === userId;
}

async function denyIfHiddenMod(pathname: string): Promise<Response | null> {
  const modId = modIdFromStoredPath(pathname);
  if (!modId) return null;
  if (!(await isModHidden(modId))) return null;
  if (await canAccessHiddenMod(modId)) return null;
  return new Response("Not found", { status: 404 });
}

async function fileResponse(pathParts: string[], download: boolean) {
  const pathname = pathParts.map((part) => decodeURIComponent(part)).join("/");
  if (isCatalogPaused() && isModZipPath(pathname)) {
    return catalogPausedResponse();
  }
  const denied = await denyIfHiddenMod(pathname);
  if (denied) return denied;
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
  if (isCatalogPaused() && isModZipPath(pathname)) {
    return catalogPausedResponse();
  }
  const denied = await denyIfHiddenMod(pathname);
  if (denied) return denied;
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
