#!/usr/bin/env node
// The deploy command of Workers Builds (`npm run ci`, set in GO-LIVE.md). For each push to main it:
//   1. reports { state: 'building' } in the admin bucket, so the admin can say a build is under way;
//   2. runs `npm run build` (the static site in out/, and the admin's index of what it holds);
//   3. runs `npx wrangler deploy --message "Build <sha7>"`;
//   4. reports { state: 'deployed' }.
// On any failure it reports { state: 'failed', step, tail } with the last 40 lines of output, which the admin shows
// with "Try again" and "Undo this publish", then exits 1. A report is a small JSON file,
// nihaalnazeer-admin/builds/<commit>.json; a report that can't be written is logged and never fails the build.
//
// It runs only in Workers Builds (WORKERS_CI is set there). Locally, use npm run build or npm run preview.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (!process.env.WORKERS_CI) {
  console.error('scripts/ci.mjs deploys the site and runs only in Workers Builds. Locally, use npm run build or npm run preview.');
  process.exit(1);
}

const sha = process.env.WORKERS_CI_COMMIT_SHA || '';
const BUCKET = 'nihaalnazeer-admin';
const TAIL_LINES = 40;
const scratch = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), 'ci-'));
let output = '';

/** Runs a command, showing its output and keeping it for the failure report. */
function run(command, args, { quiet = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    const keep = (chunk) => {
      if (!quiet) {
        output += chunk;
        if (output.length > 200_000) output = output.slice(-100_000);
      }
    };
    child.stdout.on('data', (chunk) => {
      keep(chunk.toString());
      if (!quiet) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      keep(chunk.toString());
      if (!quiet) process.stderr.write(chunk);
    });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function report(status) {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    console.log('status not written: no commit sha');
    return;
  }
  const file = path.join(scratch, 'build-status.json');
  writeFileSync(file, JSON.stringify({ ...status, at: new Date().toISOString() }));
  const code = await run(
    'npx',
    ['wrangler', 'r2', 'object', 'put', `${BUCKET}/builds/${sha}.json`, '--file', file, '--content-type', 'application/json', '--remote'],
    { quiet: true },
  );
  console.log(code === 0 ? `status written (${status.state})` : `status not written (${status.state})`);
}

const tail = () => output.split('\n').slice(-TAIL_LINES).join('\n').trim();

async function step(name, command, args) {
  console.log(`\n> ${name}`);
  const code = await run(command, args);
  if (code === 0) return;
  await report({ state: 'failed', step: name, tail: tail() });
  process.exit(1);
}

await report({ state: 'building', ...(process.env.WORKERS_CI_BUILD_UUID ? { buildUuid: process.env.WORKERS_CI_BUILD_UUID } : {}) });
await step('npm run build', 'npm', ['run', 'build']);
await step('wrangler deploy', 'npx', ['wrangler', 'deploy', '--message', `Build ${sha.slice(0, 7) || 'local'}`]);
await report({ state: 'deployed' });
