#!/usr/bin/env node
// `npm run dev`: next dev, with the admin's email, password and session secret from .dev.vars.
//
// They live in .dev.vars, not a .env file, because OpenNext copies every .env file into the Worker it builds (the
// development ones included), while nothing is built from .dev.vars. The Cloudflare preview reads .dev.vars too.
// Loaded before Next starts, so Next keeps them; a variable already set in the shell is never replaced, and a .env
// file never replaces these.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devVars = path.join(ROOT, '.dev.vars');
if (existsSync(devVars)) process.loadEnvFile(devVars);

const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [next, 'dev', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
