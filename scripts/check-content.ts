// Part of `npm run check`: content/ must load without errors (the same checks the build runs) and every file must be
// in canonical form, byte for byte what the admin would write, so a publish never rewrites a file only to reorder it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readContent } from '../lib/content/read';
import { HOME_PATH, REDIRECTS_PATH, serializeHome, serializeProject, serializeRedirects } from '../lib/content/serialize';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The file's text in canonical form, or null when it can't be read as JSON. */
function canonicalText(file: string, text: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (file === HOME_PATH) return serializeHome(value as Parameters<typeof serializeHome>[0]);
  if (file === REDIRECTS_PATH) return serializeRedirects(value as Parameters<typeof serializeRedirects>[0]);
  return serializeProject(value as Parameters<typeof serializeProject>[0]);
}

const content = readContent(ROOT);
for (const warning of content.warnings) console.warn(`warning: ${warning}`);
const problems = [...content.errors];
const unformatted = content.files.filter((f) => canonicalText(f.path, f.text) !== f.text).map((f) => f.path);
if (unformatted.length) problems.push(`Not in canonical form (fix: npm run content:format):\n  ${unformatted.join('\n  ')}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`content: ${content.projects.length} projects, ${content.home.highlights.length} highlighted, ${Object.keys(content.redirects).length} redirects, all canonical.`);
