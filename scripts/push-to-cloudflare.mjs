#!/usr/bin/env node
// Copies the local-mode content (.cms/content.json, plus any files uploaded in the local admin) into the Cloudflare
// CMS: projects and settings into D1, uploads into R2.
//
//   npm run cms:to-cloudflare                 # the local preview's D1 and R2 (.wrangler/state), the default
//   npm run cms:to-cloudflare -- --remote     # the live database and bucket (needs `npx wrangler login` first)
//   npm run cms:to-cloudflare -- --dry-run    # prints what it would do and changes nothing
//
// Projects are matched by their web address (slug): one that already exists is replaced, a new one is added, and
// projects that exist only in D1 are left alone. The site settings are replaced whole.
// Files under public/uploads/seed, public/films and the films at the root of public/ are not uploaded: they are part
// of the build and served as static assets. Files uploaded in the local admin (public/uploads/projects/... and
// public/uploads/site/...) go to R2 under cms/ and their addresses change from /uploads/... to /cms/....
// Run `npm run db:migrate:local` (or :remote) once before the first push.

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_FILE = path.join(ROOT, '.cms', 'content.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const WRANGLER_CONFIG = path.join(ROOT, 'wrangler.jsonc');
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');

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

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const dryRun = args.includes('--dry-run');
const unknown = args.filter((a) => !['--remote', '--local', '--dry-run'].includes(a));
const target = remote ? '--remote' : '--local';

function fail(message) {
  console.error(`cms:to-cloudflare: ${message}`);
  process.exit(1);
}

if (unknown.length > 0) fail(`unknown option ${unknown.join(' ')}. Use --local (the default), --remote or --dry-run.`);
if (remote && args.includes('--local')) fail('choose --local or --remote, not both.');

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** The database and bucket names from wrangler.jsonc (whole-line // comments are allowed there). */
async function readBindings() {
  const text = (await readFile(WRANGLER_CONFIG, 'utf8'))
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  const config = JSON.parse(text);
  const db = config.d1_databases?.find((d) => d.binding === 'CMS_DB');
  const bucket = config.r2_buckets?.find((b) => b.binding === 'CMS_UPLOADS');
  if (!db || !bucket) fail('wrangler.jsonc must declare the CMS_DB database and the CMS_UPLOADS bucket.');
  if (remote && /^0{8}-/.test(db.database_id)) {
    fail('wrangler.jsonc still has the placeholder database_id. Put in the id from `npx wrangler d1 create` (GO-LIVE.md, step 2).');
  }
  return { bucket: bucket.bucket_name };
}

function wrangler(commandArgs) {
  const result = spawnSync(WRANGLER, commandArgs, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS ?? 'false' },
  });
  if (result.status !== 0) {
    fail(`wrangler ${commandArgs.slice(0, 3).join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

// ---- media

const withoutSuffix = (url) => url.split(/[?#]/)[0];

/** Only files uploaded in the local admin move to R2; everything else in public/ ships with the build. */
function isAdminUpload(value) {
  return typeof value === 'string' && /^\/uploads\/(projects|site)\//.test(withoutSuffix(value));
}

function collectUploads(value, found = new Set()) {
  if (isAdminUpload(value)) found.add(withoutSuffix(value));
  else if (Array.isArray(value)) value.forEach((item) => collectUploads(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectUploads(item, found));
  return found;
}

function rewriteUploads(value) {
  if (isAdminUpload(value)) return value.replace(/^\/uploads\//, '/cms/');
  if (Array.isArray(value)) return value.map(rewriteUploads);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteUploads(item)]));
  }
  return value;
}

// ---- SQL (same columns as d1/migrations/0001_init.sql and lib/cms/cloudflare.ts)

const sql = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const PROJECT_COLUMNS = [
  'id', 'slug', 'title', 'category', 'year', 'discipline', 'summary', 'shown', 'still_only', 'cover', 'accent', 'role',
  'project_type', 'tools', 'deliverables', 'link', 'featured', 'position', 'status', 'blocks', 'created_at',
  'updated_at', 'published_at',
];

function projectValues(project, now) {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    category: project.category,
    year: project.year,
    discipline: project.discipline ?? '',
    summary: project.summary ?? '',
    shown: project.shown ?? '',
    still_only: project.stillOnly === true,
    cover: project.cover ? JSON.stringify(project.cover) : null,
    accent: project.accent ?? '#6FF3FF',
    role: project.role ?? '',
    project_type: project.projectType ?? '',
    tools: project.tools ?? '',
    deliverables: project.deliverables ?? '',
    link: project.link ?? '',
    featured: project.featured === true,
    position: project.position ?? 0,
    status: project.status === 'published' ? 'published' : 'draft',
    blocks: JSON.stringify(project.blocks ?? []),
    created_at: project.createdAt ?? now,
    updated_at: now,
    published_at: project.publishedAt ?? null,
  };
}

function projectUpsert(project, now) {
  const values = projectValues(project, now);
  // Matched by slug, so a project created in the live admin with the same address is replaced, and its id is kept.
  const updates = PROJECT_COLUMNS.filter((c) => !['id', 'slug', 'created_at'].includes(c)).map((c) => `${c} = excluded.${c}`);
  return (
    `INSERT INTO projects (${PROJECT_COLUMNS.join(', ')}) VALUES (${PROJECT_COLUMNS.map((c) => sql(values[c])).join(', ')})\n` +
    `  ON CONFLICT (slug) DO UPDATE SET ${updates.join(', ')};`
  );
}

function settingsUpsert(settings, now) {
  return (
    `INSERT INTO settings (id, data, updated_at) VALUES (1, ${sql(JSON.stringify(settings))}, ${sql(now)})\n` +
    '  ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;'
  );
}

// ---- main

async function main() {
  if (!existsSync(CONTENT_FILE)) fail('.cms/content.json not found. Run `npm run cms:seed` first.');
  if (!existsSync(WRANGLER)) fail('wrangler is not installed. Run `npm install` first.');
  const { bucket } = await readBindings();

  const content = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
  const projects = Array.isArray(content.projects) ? content.projects : [];
  const { updatedAt: _ignored, ...settings } = content.settings ?? {};

  // Check every file before changing anything.
  const files = [];
  const problems = [];
  for (const url of [...collectUploads(content)].sort()) {
    const relative = decodeURI(url).replace(/^\/uploads\//, '');
    const localPath = path.join(PUBLIC_DIR, 'uploads', relative);
    const contentType = CONTENT_TYPES[path.extname(relative).toLowerCase()];
    if (!existsSync(localPath)) problems.push(`public/uploads/${relative} is missing`);
    else if (!contentType) problems.push(`public/uploads/${relative} is not a type the admin accepts`);
    else files.push({ key: `cms/${relative}`, localPath, contentType, size: statSync(localPath).size });
  }
  if (problems.length > 0) fail(`Fix these first:\n  ${problems.join('\n  ')}`);

  const now = new Date().toISOString();
  const statements = [
    ...projects.map((p) => projectUpsert(rewriteUploads(p), now)),
    settingsUpsert(rewriteUploads(settings), now),
  ];

  const where = remote ? 'the live Cloudflare database and bucket' : 'the local preview (.wrangler/state)';
  if (dryRun) {
    console.log(`Dry run for ${where}. Nothing was changed. A real run would:`);
    console.log(`  upload ${files.length} files to R2 bucket ${bucket}:`);
    for (const f of files) console.log(`    ${f.key} (${formatSize(f.size)})`);
    console.log(`  upsert ${projects.length} projects by slug and replace the site settings in D1 (CMS_DB).`);
    return;
  }

  console.log(`Pushing to ${where}.`);
  for (const f of files) {
    process.stdout.write(`  uploading ${f.key} (${formatSize(f.size)})\n`);
    wrangler(['r2', 'object', 'put', `${bucket}/${f.key}`, `--file=${f.localPath}`, `--content-type=${f.contentType}`,
      '--cache-control=public, max-age=31536000, immutable', target]);
  }

  const dir = await mkdtemp(path.join(process.env.TMPDIR || os.tmpdir(), 'cms-to-cloudflare-'));
  try {
    const file = path.join(dir, 'content.sql');
    await writeFile(file, `${statements.join('\n')}\n`, 'utf8');
    wrangler(['d1', 'execute', 'CMS_DB', target, `--file=${file}`, '--yes']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const published = projects.filter((p) => p.status === 'published').length;
  console.log(`\nDone: ${projects.length} projects (${published} published), the site settings and ${files.length} uploads.`);
  if (!remote) console.log('Start the preview with `npm run preview` to see them.');
}

main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
