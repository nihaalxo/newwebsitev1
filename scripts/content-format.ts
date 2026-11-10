// `npm run content:format`: rewrites every file in content/ in canonical form (lib/content/serialize.ts): the key
// order the admin writes, two-space JSON and a final newline. It changes no values.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readContent } from '../lib/content/read';
import { HOME_PATH, REDIRECTS_PATH, serializeHome, serializeProject, serializeRedirects } from '../lib/content/serialize';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let changed = 0;
for (const file of readContent(ROOT).files) {
  let value: unknown;
  try {
    value = JSON.parse(file.text);
  } catch {
    console.error(`${file.path}: not valid JSON, left as it is`);
    continue;
  }
  const text =
    file.path === HOME_PATH
      ? serializeHome(value as Parameters<typeof serializeHome>[0])
      : file.path === REDIRECTS_PATH
        ? serializeRedirects(value as Parameters<typeof serializeRedirects>[0])
        : serializeProject(value as Parameters<typeof serializeProject>[0]);
  if (text !== file.text) {
    writeFileSync(path.join(ROOT, file.path), text);
    changed += 1;
    console.log(`formatted ${file.path}`);
  }
}
console.log(changed ? `${changed} file${changed === 1 ? '' : 's'} formatted.` : 'Every content file is already canonical.');
