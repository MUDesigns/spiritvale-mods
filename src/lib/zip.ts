import JSZip from "jszip";
import {
  ZIP_MAX_ENTRIES,
  ZIP_MAX_RATIO,
  ZIP_MAX_UNCOMPRESSED_BYTES,
} from "@/lib/constants";

export async function inspectZipBuffer(buffer: Buffer): Promise<string | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { createFolders: true });
  } catch {
    return "File is not a valid zip archive.";
  }

  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  if (files.length === 0) {
    return "Zip archive is empty.";
  }
  if (files.length > ZIP_MAX_ENTRIES) {
    return `Zip has too many entries (${files.length}).`;
  }

  let uncompressed = 0;
  for (const entry of files) {
    const name = entry.name.replace(/\\/g, "/");
    if (name.split("/").includes("..") || name.startsWith("/")) {
      return `Zip contains an unsafe path: ${entry.name}`;
    }
    const extra = (entry as { _data?: { uncompressedSize?: number } })._data;
    const size = extra?.uncompressedSize ?? 0;
    uncompressed += size;
    if (uncompressed > ZIP_MAX_UNCOMPRESSED_BYTES) {
      return "Zip uncompressed size is too large.";
    }
    if (
      size > 10 * 1024 * 1024 &&
      buffer.length > 0 &&
      size / buffer.length > ZIP_MAX_RATIO
    ) {
      return "Zip compression ratio looks like a zip bomb.";
    }
  }

  return null;
}
