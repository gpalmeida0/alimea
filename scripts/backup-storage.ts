/**
 * Back up or restore the uploaded files (logos, PDF templates) in Supabase
 * Storage. The database itself is dumped with pg_dump — see docs/backups.md.
 *
 *   npm run backup:storage -- download <dir>   copy every file in the bucket to <dir>
 *   npm run backup:storage -- upload <dir>     put the files from <dir> back (overwrites)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or
 * .env.local).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const BUCKET = process.env.BACKUP_BUCKET || "alimea-files";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!url || !key) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET);

/** Every object path in the bucket (folders are walked recursively). */
async function listAll(prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) fail(`list ${prefix || "/"}: ${error.message}`);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have no id; files do.
      if (entry.id) paths.push(path);
      else paths.push(...(await listAll(path)));
    }
    if (data.length < 1000) return paths;
  }
}

async function filesIn(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesIn(full)));
    else if (entry.name !== "manifest.json") out.push(full);
  }
  return out;
}

async function download(dir: string) {
  const paths = await listAll();
  const manifest: { path: string; bytes: number; contentType: string }[] = [];
  for (const path of paths) {
    const { data, error } = await storage.download(path);
    if (error || !data) fail(`download ${path}: ${error?.message ?? "no data"}`);
    const bytes = new Uint8Array(await data.arrayBuffer());
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), bytes);
    manifest.push({ path, bytes: bytes.length, contentType: data.type });
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ bucket: BUCKET, createdAt: new Date().toISOString(), files: manifest }, null, 2));
  console.log(`✔ ${manifest.length} file(s), ${manifest.reduce((s, f) => s + f.bytes, 0)} bytes → ${dir}`);
}

async function upload(dir: string) {
  const manifestPath = join(dir, "manifest.json");
  const types = new Map<string, string>();
  if (existsSync(manifestPath)) {
    for (const f of JSON.parse(await readFile(manifestPath, "utf8")).files ?? []) types.set(f.path, f.contentType);
  }
  const files = await filesIn(dir);
  for (const file of files) {
    const path = relative(dir, file).split("\\").join("/");
    const { error } = await storage.upload(path, await readFile(file), { upsert: true, contentType: types.get(path) });
    if (error) fail(`upload ${path}: ${error.message}`);
  }
  console.log(`✔ ${files.length} file(s) uploaded to ${BUCKET}`);
}

const [command, dir] = process.argv.slice(2);
if (!dir || (command !== "download" && command !== "upload")) fail("Usage: npm run backup:storage -- <download|upload> <dir>");
void (command === "download" ? download(dir) : upload(dir));
