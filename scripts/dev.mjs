#!/usr/bin/env node
// `npm run dev`: next dev, with the admin's password (ADMIN_PASSWORD) from .dev.vars, the same file `npm run preview`
// reads. Loaded before Next starts, so Next keeps it; a variable already set in the shell is never replaced.

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
