#!/usr/bin/env node
// Runs at the end of `npm run cf:build`. Lists the size of every film in .open-next/assets (public/ as the Worker
// ships it) in .open-next/film-sizes.json, keyed by its address ("/films/lair-ship.mp4"). cloudflare/worker.mjs
// needs the sizes to answer Range requests, because a static asset reaches the Worker without its length.

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, '.open-next', 'assets');
const FILM = /\.(mp4|webm|mov|m4v)$/i;

const sizes = {};
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (FILM.test(entry.name)) sizes[`/${path.relative(ASSETS, full).split(path.sep).join('/')}`] = statSync(full).size;
  }
}

try {
  walk(ASSETS);
} catch (error) {
  console.error(`film-sizes: could not read ${path.relative(ROOT, ASSETS)}. Run \`opennextjs-cloudflare build\` first.`);
  throw error;
}
writeFileSync(path.join(ROOT, '.open-next', 'film-sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
console.log(`film-sizes: ${Object.keys(sizes).length} films listed for byte-range serving.`);
