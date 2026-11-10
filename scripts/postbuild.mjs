#!/usr/bin/env node
// Runs at the end of `npm run build`, after `next build` has exported the site into out/. It:
// - writes out/_redirects: public/_redirects plus the renamed and removed projects from content/redirects.json;
// - writes out/admin/data/index.json (which version of each content file this build holds; the admin compares it
//   with what it published to know when a publish is live) and out/admin/data/published.json (the published
//   content, which the admin lays its drafts over);
// - lists every film's size in .build/film-sizes.json, which the Worker needs to answer byte ranges (worker/films.ts);
// - checks the output against Cloudflare's limits for static assets, and that no page points at localhost.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const MiB = 1024 * 1024;
const LIMITS = { fileBytes: 25 * MiB, files: 20000, redirects: 2000 };
const FILM = /\.(mp4|webm|mov|m4v)$/i;

register();
const { readContent } = await import('../lib/content/read.ts');

const problems = [];
const fail = (message) => problems.push(message);

/** git's id for a file's bytes: SHA-1 of "blob <length>\0" and the bytes (lib/content/blob-sha.ts). */
const blobSha = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// ---------------------------------------------------------------- content
const content = readContent(ROOT);
if (content.errors.length) {
  console.error(content.errors.join('\n'));
  process.exit(1);
}

// ---------------------------------------------------------------- every file in out/
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
})(OUT);
const urlOf = (full) => `/${path.relative(OUT, full).split(path.sep).join('/')}`;
const pages = new Set(files.filter((f) => f.endsWith('.html')).map((f) => urlOf(f).replace(/\.html$/, '').replace(/\/index$/, '') || '/'));

// ---------------------------------------------------------------- _redirects
const redirectLines = Object.entries(content.redirects)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([from, { to, status }]) => {
    if (pages.has(from)) fail(`content/redirects.json: ${from} is also a page in out/, so the redirect would hide it`);
    return `${from} ${to} ${status}`;
  });
const staticRedirects = readFileSync(path.join(ROOT, 'public/_redirects'), 'utf8').trimEnd();
const redirects = `${staticRedirects}\n${redirectLines.length ? `\n# Renamed and removed projects (content/redirects.json)\n${redirectLines.join('\n')}\n` : ''}`;
writeFileSync(path.join(OUT, '_redirects'), redirects);
const ruleCount = redirects.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
if (ruleCount > LIMITS.redirects) fail(`_redirects has ${ruleCount} rules; Cloudflare allows ${LIMITS.redirects}`);

// ---------------------------------------------------------------- admin data
const indexFiles = {};
for (const { path: file } of content.files) {
  const bytes = readFileSync(path.join(ROOT, file));
  const project = content.projects.find((p) => `content/projects/${p.slug}.json` === file);
  indexFiles[file] = project ? { id: project.id, blobSha: blobSha(bytes) } : { blobSha: blobSha(bytes) };
}
const index = {
  commit: process.env.WORKERS_CI_COMMIT_SHA || 'local',
  builtAt: new Date().toISOString(),
  files: Object.fromEntries(Object.keys(indexFiles).sort().map((key) => [key, indexFiles[key]])),
};
mkdirSync(path.join(OUT, 'admin/data'), { recursive: true });
writeFileSync(path.join(OUT, 'admin/data/index.json'), `${JSON.stringify(index, null, 2)}\n`);
const published = { projects: content.projects, home: content.home, redirects: content.redirects };
writeFileSync(path.join(OUT, 'admin/data/published.json'), `${JSON.stringify(published)}\n`);

// ---------------------------------------------------------------- film sizes, for byte ranges
const sizes = {};
for (const file of files) if (FILM.test(file)) sizes[urlOf(file)] = statSync(file).size;
mkdirSync(path.join(ROOT, '.build'), { recursive: true });
writeFileSync(path.join(ROOT, '.build/film-sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);

// ---------------------------------------------------------------- Cloudflare's limits, and no localhost
const all = [...files, path.join(OUT, '_redirects'), path.join(OUT, 'admin/data/index.json'), path.join(OUT, 'admin/data/published.json')];
const count = new Set(all).size;
if (count >= LIMITS.files) fail(`out/ holds ${count} files; Cloudflare allows fewer than ${LIMITS.files}`);
let largest = { file: '', size: 0 };
for (const file of new Set(all)) {
  const { size } = statSync(file);
  if (size > largest.size) largest = { file, size };
  if (size > LIMITS.fileBytes) fail(`${urlOf(file)} is ${(size / MiB).toFixed(1)} MiB; Cloudflare serves files up to 25 MiB`);
  if (file.endsWith('.html') && readFileSync(file, 'utf8').includes('localhost')) {
    fail(`${urlOf(file)} mentions localhost: build with the live addresses (unset NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_LAIR_URL)`);
  }
}

if (problems.length) {
  console.error(`postbuild: ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
for (const warning of content.warnings) console.warn(`content: ${warning}`);
console.log(
  `postbuild: ${count} files (largest ${urlOf(largest.file)}, ${(largest.size / MiB).toFixed(1)} MiB), ${ruleCount} redirects, ` +
    `${Object.keys(sizes).length} films, ${content.projects.length} projects, commit ${index.commit}.`,
);
