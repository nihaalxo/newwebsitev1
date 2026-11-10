#!/usr/bin/env node
// `npm run dev`: next dev, with the admin's password (ADMIN_PASSWORD) from .dev.vars, the same file `npm run preview`
// reads. Loaded before Next starts, so Next keeps it; a variable already set in the shell is never replaced.
// It listens on this computer only (127.0.0.1), since the dev admin writes into content/; `npm run dev -- -H 0.0.0.0`
// opens it to the local network, to try the site on a phone.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devVars = path.join(ROOT, '.dev.vars');
if (existsSync(devVars)) process.loadEnvFile(devVars);

const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const args = process.argv.slice(2);
const host = args.some((a) => a === '-H' || a === '--hostname' || a.startsWith('--hostname=')) ? [] : ['-H', '127.0.0.1'];
const child = spawn(process.execPath, [next, 'dev', ...host, ...args], { cwd: ROOT, stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
