#!/usr/bin/env node
// The live admin's API end to end, under `npm run preview` (wrangler dev with local R2) and tests/fake-github.mjs.
// Start both first, with GITHUB_TOKEN=test and GITHUB_API=http://127.0.0.1:<fake port> in .dev.vars:
//   node tests/fake-github.mjs 4830 & PORT=4821 npm run preview &
//   node tests/preview-admin.mjs http://127.0.0.1:4821 http://127.0.0.1:4830
// It uploads a 120 MB film in parts (one part fails once and is sent again), publishes through the fake GitHub,
// checks the commit, a moved branch, a refused ref update, the media check, and follows /state from building to live
// (rebuilding out/ from the fake commit's content) and to failed. It changes content/ while it runs and puts it back
// with git checkout, then rebuilds out/.

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.argv[2] ?? 'http://127.0.0.1:4821';
const FAKE = process.argv[3] ?? 'http://127.0.0.1:4830';
const MEDIA_ORIGIN = 'https://media.nihaalnazeer.com';
const TMP = process.env.TMPDIR;
const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

// It ends with git checkout -- content, so it refuses to start while content/ has changes of its own to lose.
if (execFileSync('git', ['status', '--porcelain', '--', 'content'], { cwd: ROOT, encoding: 'utf8' }).trim()) {
  console.error('content/ has uncommitted changes: commit them first, because this check puts content/ back with git checkout.');
  process.exit(1);
}

const password = readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) throw new Error('.dev.vars has no ADMIN_PASSWORD');

let cookie = '';
async function api(method, route, body, headers = {}) {
  const response = await fetch(`${SITE}/api/admin/${route}`, {
    method,
    headers: { origin: SITE, cookie, ...(body !== undefined && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}
const fake = async (route, body) => (await fetch(`${FAKE}/_fake/${route}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})).json();

/** Sends `bytes` as one part, but drops the connection halfway: a part that fails on the way. */
function brokenPart(url, bytes) {
  return new Promise((resolve) => {
    const req = httpRequest(url, { method: 'PUT', headers: { origin: SITE, cookie, 'content-type': 'video/mp4', 'content-length': bytes.length } });
    req.on('error', () => resolve('connection dropped'));
    req.on('response', (res) => resolve(`answered ${res.statusCode}`));
    req.write(bytes.subarray(0, Math.floor(bytes.length / 2)), () => setTimeout(() => req.destroy(new Error('dropped')), 200));
  });
}

function build(label) {
  const run = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8', env: process.env });
  check(`npm run build (${label})`, run.status === 0, run.status === 0 ? '' : run.stdout.slice(-500) + run.stderr.slice(-500));
}

const until = async (what, test, tries = 30) => {
  for (let i = 0; i < tries; i++) {
    const value = await test();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
};

// ---------------------------------------------------------------- sign in
const signIn = await fetch(`${SITE}/api/admin/session`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0];
check('sign in', signIn.status === 204 && cookie.startsWith('__Host-nn_admin='), `status ${signIn.status}`);

const published = await (await fetch(`${SITE}/admin/data/published.json`)).json();
const chaii = published.projects.find((p) => p.slug === 'my-chaii-london');
const football = published.projects.find((p) => p.slug === 'football-on-the-vision-pro');
// Start clean: no drafts left from an earlier run.
for (const id of [chaii.id, football.id]) await api('DELETE', `drafts/${id}`);
await api('DELETE', 'home');

// ---------------------------------------------------------------- a 120 MB film in 50 MiB parts
const SIZE = 120 * 1000 * 1000;
const film = randomBytes(SIZE);
film.write('\0\0\0\x18ftypmp42', 0, 'latin1');
const start = await api('POST', 'upload/start', { project: chaii.id, field: 'film', type: 'video/mp4', size: SIZE });
check('upload/start', start.status === 200 && start.data.partSize === 50 * 1024 * 1024, JSON.stringify(start.data));
const { key, uploadId, partSize } = start.data;
const count = Math.ceil(SIZE / partSize);
const parts = [];
for (let n = 1; n <= count; n++) {
  const bytes = film.subarray((n - 1) * partSize, Math.min(SIZE, n * partSize));
  const url = `${SITE}/api/admin/upload/part?${new URLSearchParams({ key, uploadId, n: String(n) })}`;
  if (n === 2) {
    const failed = await brokenPart(url, bytes);
    check('part 2 fails on the way', true, failed);
  }
  const sent = await api('PUT', `upload/part?${new URLSearchParams({ key, uploadId, n: String(n) })}`, new Uint8Array(bytes), { 'content-type': 'video/mp4' });
  check(`part ${n} of ${count} (${Math.round(bytes.length / 1e6)} MB)${n === 2 ? ', sent again' : ''}`, sent.status === 200 && sent.data.partNumber === n, `status ${sent.status}`);
  parts.push({ partNumber: n, etag: sent.data.etag });
}
const finished = await api('POST', 'upload/finish', { key, uploadId, parts });
check('upload/finish gives the media address', finished.status === 200 && finished.data.url === `${MEDIA_ORIGIN}/${key}`, finished.data?.url);
const head = await fetch(`${SITE}/api/admin/media/${key}`, { method: 'HEAD', headers: { cookie } });
check('the stored film is 120 MB', head.status === 200 && Number(head.headers.get('content-length')) === SIZE, `${head.status} ${head.headers.get('content-length')}`);
const slice = await fetch(`${SITE}/api/admin/media/${key}`, { headers: { cookie, range: 'bytes=52428700-52428899' } });
const sliceBytes = Buffer.from(await slice.arrayBuffer());
check('a range across parts 1 and 2 matches the file', slice.status === 206 && sliceBytes.equals(film.subarray(52428700, 52428900)), `status ${slice.status}`);

// ---------------------------------------------------------------- publish: one commit, content/ only
const seed = (await fake('state')).head;
const edited = {
  ...chaii,
  summary: 'Tea for London, now with its film.',
  blocks: [...chaii.blocks, { id: '33333333-3333-4333-8333-333333333333', type: 'video', media: { kind: 'video', src: `${MEDIA_ORIGIN}/${key}`, alt: '' }, caption: 'The film', loop: false }],
};
const saved = await api('PUT', `drafts/${chaii.id}`, { project: edited, action: 'publish' });
check('save the draft', saved.status === 200, JSON.stringify(saved.data));
const publish = await api('POST', 'publish', { items: [{ id: chaii.id, etag: saved.data.etag }], home: null });
check('publish', publish.status === 200 && /^[0-9a-f]{40}$/.test(publish.data?.commit ?? ''), JSON.stringify(publish.data));
const after = await fake('state');
const commit = after.commits[0];
check('one commit on the branch', after.head === publish.data.commit && commit.parents.length === 1 && commit.parents[0] === seed, `parent ${commit.parents[0]?.slice(0, 7)}`);
check('it holds only content/ paths', commit.paths.length > 0 && commit.paths.every((p) => p.startsWith('content/')), commit.paths.join(', '));
check('its message', commit.message === 'Publish: My Chaii London (edited)', commit.message);

// ---------------------------------------------------------------- following it: building, then live after a rebuild
let state = await api('GET', 'state');
check('/state says building', state.data?.build?.state === 'building', JSON.stringify(state.data?.build));
const files = await fake(`files?commit=${publish.data.commit}`);
for (const [file, text] of Object.entries(files)) {
  if (!file.startsWith('content/')) continue;
  mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  writeFileSync(path.join(ROOT, file), text);
}
build('with the fake commit');
state = await until('live', async () => {
  const s = await api('GET', 'state');
  return s.data?.build?.state === 'live' ? s : null;
});
check('/state says live after the rebuild', Boolean(state), JSON.stringify(state?.data?.build));
check('the draft is done with once live', state && !state.data.drafts.some((d) => d.id === chaii.id));

// ---------------------------------------------------------------- a failed build
const football1 = await api('PUT', `drafts/${football.id}`, { project: { ...football, summary: `${football.summary} Again.` }, action: 'publish' });
const publish2 = await api('POST', 'publish', { items: [{ id: football.id, etag: football1.data.etag }], home: null });
check('second publish', publish2.status === 200, JSON.stringify(publish2.data));
mkdirSync(TMP, { recursive: true });
const report = path.join(TMP, 'failed-report.json');
writeFileSync(report, JSON.stringify({ state: 'failed', at: new Date().toISOString(), step: 'npm run build', tail: 'Error: something broke' }));
const put = spawnSync('npx', ['wrangler', 'r2', 'object', 'put', `nihaalnazeer-admin/builds/${publish2.data.commit}.json`, '--file', report, '--content-type', 'application/json', '--local'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
check('write builds/<sha>.json to local R2', put.status === 0, put.stderr.slice(-300));
state = await api('GET', 'state');
check('/state says failed', state.data?.build?.state === 'failed' && state.data.build.step === 'npm run build', JSON.stringify(state.data?.build));
check('the draft is marked failed', state.data?.drafts.find((d) => d.id === football.id)?.state === 'failed');

// ---------------------------------------------------------------- a changed HEAD, and a refused ref update
await fake('move-head', { path: 'content/projects/football-on-the-vision-pro.json', content: '{"changed":"by someone else"}\n', message: 'Someone else' });
const edit3 = await api('GET', `drafts/${football.id}`);
const saved3 = await api('PUT', `drafts/${football.id}`, { project: { ...edit3.data.draft.project, summary: 'Third.' }, action: 'publish' }, { 'if-match': `"${edit3.data.etag}"` });
const conflict = await api('POST', 'publish', { items: [{ id: football.id, etag: saved3.data.etag }], home: null });
check('a changed HEAD gives 409', conflict.status === 409, JSON.stringify(conflict.data));

const order = published.home.order.map((slug) => published.projects.find((p) => p.slug === slug).id);
const homeSaved = await api('PUT', 'home', { highlights: [order[2]], order: [...order].reverse() });
check('save the home draft', homeSaved.status === 200, JSON.stringify(homeSaved.data));
await fake('fail-next', { method: 'PATCH', status: 422, times: 1 });
const patchesBefore = (await fake('state')).log.filter((l) => l.startsWith('PATCH')).length;
const retried = await api('POST', 'publish', { items: [], home: homeSaved.data.etag });
const log = (await fake('state')).log;
check('a 422 on the ref update retries and publishes', retried.status === 200 && log.filter((l) => l.startsWith('PATCH')).length === patchesBefore + 2, JSON.stringify(retried.data));
check('that commit is the home page', (await fake('state')).commits[0].message === 'Publish: Home page (order and highlights)');

// ---------------------------------------------------------------- the media check
const missing = `${MEDIA_ORIGIN}/p/${chaii.id}/cover-20261109120000-zzzzzz.webp`;
const current = await api('GET', `drafts/${chaii.id}`);
const draftMissing = await api(
  'PUT',
  `drafts/${chaii.id}`,
  { project: { ...chaii, cover: { kind: 'image', src: missing, srcSmall: missing, alt: 'A cover', width: 10, height: 10 } }, action: 'publish' },
  current.status === 200 ? { 'if-match': `"${current.data.etag}"` } : {},
);
const refused = await api('POST', 'publish', { items: [{ id: chaii.id, etag: draftMissing.data.etag }], home: null });
check('a missing upload is refused', refused.status === 422 && refused.data.errors?.[chaii.id]?.cover === "This file didn't finish uploading: upload it again", JSON.stringify(refused.data));

// ---------------------------------------------------------------- put content/ back
execFileSync('git', ['checkout', '--', 'content'], { cwd: ROOT });
build('content/ restored');

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : `\nALL ${results.length} PASSED`);
process.exit(failed.length ? 1 : 0);
