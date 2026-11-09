#!/usr/bin/env node
// Copies the local-mode content (.cms/content.json and the files it points at) into your Supabase project.
//
//   npm run cms:push                  # or: node --env-file=.env.local scripts/push-to-supabase.mjs
//   npm run cms:push -- --dry-run     # shows what would happen, without connecting to Supabase
//
// 1. Uploads every local file the content references (anything under /uploads/ and the films at the root of
//    /public) to the 'media' bucket at the same path, skipping files that are already there at the same size.
// 2. Rewrites those URLs to the bucket's public URLs.
// 3. Upserts every project by slug, and the settings row. Projects that exist only in Supabase are left alone.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service role key bypasses Row Level Security,
// so it stays on your machine: this script never prints it, and it must never be given to Vercel or the browser.

import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_FILE = path.join(ROOT, '.cms', 'content.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BUCKET = 'media';
const MAX_BYTES = 50 * 1024 * 1024; // the bucket's file size limit

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
};

const dryRun = process.argv.includes('--dry-run');

function fail(message) {
  console.error(`cms:push: ${message}`);
  process.exit(1);
}

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// ---- Environment

/** `npm run cms:push` doesn't pass --env-file, so fall back to reading .env.local directly. */
function loadEnv() {
  const envFile = path.join(ROOT, '.env.local');
  const needed = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  if (needed.some((name) => !process.env[name]) && existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local (Supabase > Project Settings > API).');
  if (!dryRun && !serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase > Project Settings > API).');
  if (serviceKey && looksLikePublicKey(serviceKey)) {
    fail('SUPABASE_SERVICE_ROLE_KEY holds the public anon key. Use the service_role (secret) key instead.');
  }
  return { url, serviceKey };
}

/** True for the anon or publishable key, which can't write past Row Level Security. */
function looksLikePublicKey(key) {
  if (key.startsWith('sb_publishable_')) return true;
  const [, payload] = key.split('.');
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role === 'anon';
  } catch {
    return false;
  }
}

// ---- Finding and rewriting media URLs

/** Strips any query or fragment, e.g. the "#t=9" a page may add to a film. */
const withoutSuffix = (url) => url.split(/[?#]/)[0];

/** Files this script uploads: anything under /uploads/, and .mp4 films at the root of /public. */
function isLocalMedia(value) {
  if (typeof value !== 'string') return false;
  const bare = withoutSuffix(value);
  return bare.startsWith('/uploads/') || /^\/[^/]+\.mp4$/i.test(bare);
}

function collectMedia(value, found = new Set()) {
  if (isLocalMedia(value)) found.add(withoutSuffix(value));
  else if (Array.isArray(value)) value.forEach((item) => collectMedia(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectMedia(item, found));
  return found;
}

function rewriteMedia(value, publicUrls) {
  if (isLocalMedia(value)) {
    const bare = withoutSuffix(value);
    return publicUrls.get(bare) + value.slice(bare.length);
  }
  if (Array.isArray(value)) return value.map((item) => rewriteMedia(item, publicUrls));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteMedia(item, publicUrls)]));
  }
  return value;
}

/** "/uploads/seed/a.webp" is stored at "uploads/seed/a.webp" in the bucket. */
const storagePathOf = (url) => decodeURI(url).replace(/^\/+/, '');

/** Matches what supabase-js getPublicUrl() returns. */
const publicUrlOf = (supabaseUrl, storagePath) => encodeURI(`${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`);

// ---- Rows (same mapping as lib/cms/rows.ts)

function projectRow(project) {
  return {
    slug: project.slug,
    title: project.title,
    category: project.category,
    year: project.year,
    discipline: project.discipline,
    summary: project.summary,
    shown: project.shown ?? '',
    still_only: project.stillOnly === true,
    cover: project.cover,
    accent: project.accent,
    role: project.role,
    project_type: project.projectType,
    tools: project.tools,
    deliverables: project.deliverables,
    link: project.link,
    featured: project.featured,
    position: project.position,
    status: project.status,
    blocks: project.blocks,
    created_at: project.createdAt,
    published_at: project.publishedAt,
  };
}

// ---- Supabase

async function existingSizes(storage, folders) {
  const sizes = new Map();
  for (const folder of folders) {
    const { data, error } = await storage.list(folder, { limit: 1000 });
    if (error) fail(`Could not read the '${BUCKET}' bucket: ${error.message}. Did you run supabase/migrations/0001_init.sql?`);
    for (const item of data) {
      if (item.metadata?.size !== undefined) sizes.set(folder ? `${folder}/${item.name}` : item.name, item.metadata.size);
    }
  }
  return sizes;
}

async function uploadMedia(storage, files) {
  const folders = [...new Set(files.map((f) => path.posix.dirname(f.storagePath)).map((d) => (d === '.' ? '' : d)))];
  const already = await existingSizes(storage, folders);
  let uploaded = 0;
  let uploadedBytes = 0;
  let skipped = 0;
  for (const file of files) {
    if (already.get(file.storagePath) === file.size) {
      skipped += 1;
      continue;
    }
    process.stdout.write(`  uploading ${file.storagePath} (${formatSize(file.size)})\n`);
    const body = await readFile(file.localPath);
    const { error } = await storage.upload(file.storagePath, body, { contentType: file.contentType, upsert: true });
    if (error) fail(`Upload of ${file.storagePath} failed: ${error.message}`);
    uploaded += 1;
    uploadedBytes += file.size;
  }
  return { uploaded, uploadedBytes, skipped };
}

// ---- Main

async function main() {
  const { url, serviceKey } = loadEnv();
  if (!existsSync(CONTENT_FILE)) fail('.cms/content.json not found. Run `npm run cms:seed` first.');
  const content = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
  const projects = Array.isArray(content.projects) ? content.projects : [];
  const { updatedAt: _ignored, ...settings } = content.settings ?? {};

  // Check every referenced file before changing anything.
  const files = [];
  const problems = [];
  for (const mediaUrl of [...collectMedia(content)].sort()) {
    const storagePath = storagePathOf(mediaUrl);
    const localPath = path.join(PUBLIC_DIR, storagePath);
    const contentType = CONTENT_TYPES[path.extname(storagePath).toLowerCase()];
    if (!existsSync(localPath)) problems.push(`public/${storagePath} is missing`);
    else if (!contentType) problems.push(`public/${storagePath} is not a type the bucket accepts`);
    else {
      const { size } = statSync(localPath);
      if (size > MAX_BYTES) problems.push(`public/${storagePath} is ${formatSize(size)}; the limit is 50 MB`);
      files.push({ mediaUrl, storagePath, localPath, contentType, size });
    }
  }
  if (problems.length > 0) fail(`Fix these first:\n  ${problems.join('\n  ')}`);

  const publicUrls = new Map(files.map((f) => [f.mediaUrl, publicUrlOf(url, f.storagePath)]));
  const rows = projects.map((p) => rewriteMedia(projectRow(p), publicUrls));
  const settingsData = rewriteMedia(settings, publicUrls);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  console.log(`Supabase project: ${url}`);
  if (dryRun) {
    console.log(`\nDry run. Nothing was sent. A real run would:`);
    console.log(`  upload up to ${files.length} files (${formatSize(totalBytes)}) to the '${BUCKET}' bucket, skipping any already there:`);
    for (const f of files) console.log(`    ${f.storagePath} (${formatSize(f.size)})`);
    console.log(`  upsert ${rows.length} projects by slug, e.g. ${rows[0]?.slug ?? '(none)'} with cover ${rows[0]?.cover?.src ?? '(none)'}`);
    console.log(`  save the settings row, with the hero film at ${settingsData.heroFilm?.src ?? '(none)'}`);
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`\nMedia`);
  const media = await uploadMedia(supabase.storage.from(BUCKET), files);

  const { data: before, error: readError } = await supabase.from('projects').select('slug');
  if (readError) fail(`Could not read projects: ${readError.message}. Did you run supabase/migrations/0001_init.sql?`);
  const existingSlugs = new Set(before.map((row) => row.slug));
  const localSlugs = new Set(rows.map((row) => row.slug));

  if (rows.length > 0) {
    const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'slug' });
    if (error) fail(`Could not save projects: ${error.message}`);
  }

  const { error: settingsError } = await supabase.from('settings').upsert({ id: 1, data: settingsData });
  if (settingsError) fail(`Could not save settings: ${settingsError.message}`);

  const created = rows.filter((row) => !existingSlugs.has(row.slug)).length;
  const onlyRemote = [...existingSlugs].filter((slug) => !localSlugs.has(slug));
  console.log(`\nDone.`);
  console.log(`  Media:    ${media.uploaded} uploaded (${formatSize(media.uploadedBytes)}), ${media.skipped} already there`);
  console.log(`  Projects: ${rows.length} saved (${created} new, ${rows.length - created} updated)`);
  console.log(`  Settings: saved`);
  if (onlyRemote.length > 0) console.log(`  Left alone, because they only exist in Supabase: ${onlyRemote.join(', ')}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
