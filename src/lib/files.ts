import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { getFile } from "@/lib/data/repo";
import type { StoredFile } from "@/lib/data/repo-types";

/**
 * Stored files are referenced by storage key ("<tenant>/<kind>-<id>.<ext>").
 * Legacy values that start with "/" point into /public (e.g. the default logo).
 */
export function fileUrl(key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("/") || /^https?:\/\//.test(key)) return key;
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Load a stored file (tenant-scoped) or a file under /public. */
export async function loadFile(key: string | undefined): Promise<StoredFile | undefined> {
  if (!key) return undefined;
  if (key.startsWith("/")) {
    const publicDir = join(process.cwd(), "public");
    const path = normalize(join(publicDir, key));
    if (!path.startsWith(publicDir)) return undefined; // path traversal guard
    try {
      const bytes = new Uint8Array(await readFile(path));
      const contentType = /\.png$/i.test(path) ? "image/png" : /\.jpe?g$/i.test(path) ? "image/jpeg" : "application/pdf";
      return { bytes, contentType };
    } catch {
      return undefined;
    }
  }
  return getFile(key);
}
