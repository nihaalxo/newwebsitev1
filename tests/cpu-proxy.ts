// A stand-in for the Free plan's 10 ms CPU limit: times the admin API's heaviest requests in Node, on this
// computer, with the in-memory store (so storage and network time are left out, as they are from Workers' CPU time).
// Run: node --import tsx tests/cpu-proxy.ts. Each figure must stay under 3 ms.

import { performance } from 'node:perf_hooks';
import { signIn } from '@/lib/admin-api/auth';
import { handleAdminApi } from '@/lib/admin-api/handler';
import { planPublish } from '@/lib/admin-api/plan';
import type { Block, Draft, Project } from '@/lib/cms/types';
import { contentFixture, draftOf, memoryStore } from './memory-store';

const ORIGIN = 'https://nihaalnazeer.com';
const RUNS = 50;
const fixture = contentFixture();
const projects = fixture.content.projects;
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

async function time(label: string, work: () => Promise<unknown>): Promise<number> {
  for (let i = 0; i < 10; i++) await work();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await work();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`${label}: median ${median.toFixed(2)} ms, slowest ${samples.at(-1)?.toFixed(2)} ms over ${RUNS} runs`);
  return median;
}

const store = memoryStore();
const signedIn = await signIn(store, 'correct horse', '1.2.3.4');
if (!signedIn.ok) throw new Error('sign-in failed');
const cookie = signedIn.cookie.split(';')[0];

// ---- GET /state with 40 drafts
for (let n = 0; n < 40; n++) {
  const live = projects[n % projects.length];
  const draft: Draft =
    n < projects.length
      ? draftOf({ ...live, summary: `Draft ${n}` }, { path: `content/projects/${live.slug}.json`, blobSha: fixture.head.files[`content/projects/${live.slug}.json`] })
      : draftOf({ ...live, id: id(n), slug: `draft-${n}`, title: `Draft ${n}` }, null);
  await store.drafts.put(draft.project.id, draft, null);
}
const state = await time('GET /api/admin/state, 40 drafts', async () => {
  const response = await handleAdminApi(new Request(`${ORIGIN}/api/admin/state`, { headers: { cookie } }), store);
  if (response.status !== 200) throw new Error(`state ${response.status}`);
  await response.text();
});

// ---- PUT /api/admin/drafts/<id>, about 400 KB
const big = { ...projects[0], id: id(99), slug: 'big-draft', title: 'Big draft' };
const blocks: Block[] = Array.from({ length: 20 }, (_, n) => ({ id: id(1000 + n), type: 'text', heading: `Part ${n}`, body: 'A long paragraph of the story. '.repeat(665) }));
const body = JSON.stringify({ project: { ...big, blocks }, action: 'publish' });
console.log(`draft body: ${Math.round(body.length / 1024)} KB`);
let etag: string | null = null;
const save = await time('PUT /api/admin/drafts/<id>, 400 KB', async () => {
  const response = await handleAdminApi(
    new Request(`${ORIGIN}/api/admin/drafts/${big.id}`, {
      method: 'PUT',
      headers: { cookie, origin: ORIGIN, 'content-type': 'application/json', ...(etag ? { 'if-match': `"${etag}"` } : {}) },
      body,
    }),
    store,
  );
  if (response.status !== 200) throw new Error(`save ${response.status}: ${await response.text()}`);
  etag = ((await response.json()) as { etag: string }).etag;
});

// ---- a publish plan of 20 projects
const twenty = projects.slice(0, 20).map((p: Project) =>
  draftOf({ ...p, summary: `${p.summary} (edited)` }, { path: `content/projects/${p.slug}.json`, blobSha: fixture.head.files[`content/projects/${p.slug}.json`] }),
);
const plan = await time('planPublish, 20 projects', async () => {
  const result = await planPublish({ index: fixture.index, head: fixture.head, drafts: twenty, homeDraft: null });
  if (result.writes.length !== 20 || result.conflicts.length) throw new Error('unexpected plan');
});

const worst = Math.max(state, save, plan);
console.log(worst < 3 ? `PASS: every figure under 3 ms (worst ${worst.toFixed(2)} ms)` : `FAIL: ${worst.toFixed(2)} ms is over 3 ms`);
process.exit(worst < 3 ? 0 : 1);
