#!/usr/bin/env node
// Runs before `npm run cf:build` and `npm run deploy`.
//
// OpenNext copies every .env file it finds into the Worker it builds: .env, .env.local, and the .production,
// .development and .test variants of both. So no .env file may hold a secret. The admin's email, password and session
// secret go in .dev.vars on this computer (`npm run dev` and `npm run preview` both read it) and in the Worker's
// secrets on Cloudflare (`npx wrangler secret put NAME`, GO-LIVE.md step 5).
//
// It also stops a build whose public addresses would point at this computer: a production build reads .env,
// .env.local, .env.production and .env.production.local, and NEXT_PUBLIC_* values are fixed into the pages then.
//
// Only variable names are printed, never values.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPENNEXT_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
];
const PRODUCTION_ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];
const SECRETS = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'LOCAL_SESSION_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
const PUBLIC_URLS = ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_LAIR_URL'];

/** name -> value for each assignment in an env file. */
function readEnv(file) {
  const vars = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match) vars.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2'));
  }
  return vars;
}

const secrets = [];
const localUrls = [];
for (const file of OPENNEXT_ENV_FILES) {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) continue;
  const vars = readEnv(full);
  const found = SECRETS.filter((name) => vars.get(name));
  if (found.length > 0) secrets.push(`${file} sets ${found.join(', ')}`);
  if (PRODUCTION_ENV_FILES.includes(file)) {
    const local = PUBLIC_URLS.filter((name) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(vars.get(name) ?? ''));
    if (local.length > 0) localUrls.push(`${file} points ${local.join(', ')} at this computer`);
  }
}

if (secrets.length > 0 || localUrls.length > 0) {
  const lines = [...secrets, ...localUrls].join('\n  ');
  const advice = [];
  if (secrets.length > 0) {
    advice.push(
      'Move those lines into .dev.vars (npm run dev and npm run preview both read it; nothing is built from it), ' +
        'and keep the live values as Worker secrets: npx wrangler secret put ADMIN_PASSWORD, and so on (GO-LIVE.md, steps 5 and 6).',
    );
  }
  if (localUrls.length > 0) {
    advice.push(
      'Put local addresses in .env.development.local, which only npm run dev reads, or delete the line to use the ' +
        'live default (GO-LIVE.md, step 7).',
    );
  }
  console.error(`deploy: stopped before building.\n  ${lines}\n\n${advice.join('\n')}`);
  process.exit(1);
}
console.log('deploy: no secrets in the .env files, and no local addresses in the build.');
