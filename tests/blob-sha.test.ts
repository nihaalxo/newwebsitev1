import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { gitBlobSha } from '@/lib/content/blob-sha';
import { readContent } from '@/lib/content/read';
import { ROOT } from './memory-store';

test('gitBlobSha equals git hash-object for every content file', async () => {
  const files = readContent(ROOT).files.map((f) => f.path);
  assert.ok(files.length >= 23);
  const git = execFileSync('git', ['hash-object', ...files], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
  for (const [i, file] of files.entries()) {
    assert.equal(await gitBlobSha(readFileSync(path.join(ROOT, file))), git[i], file);
    assert.equal(await gitBlobSha(readFileSync(path.join(ROOT, file), 'utf8')), git[i], file);
  }
});
