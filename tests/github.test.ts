import assert from 'node:assert/strict';
import { test } from 'node:test';
import { githubRepo } from '@/lib/admin-api/github';
import { LATEST_KEY, publish, settle, type LatestPublish } from '@/lib/admin-api/publish';
import { RepoError } from '@/lib/admin-api/store';
import type { Project } from '@/lib/cms/types';
import { createFakeGitHub, seedFrom } from './fake-github.mjs';
import { ROOT, contentFixture, draftOf, memoryStore } from './memory-store';

const NOW = new Date('2026-11-09T12:00:00Z');

function setup() {
  const fake = createFakeGitHub(seedFrom(ROOT));
  const repo = githubRepo({ token: 'test-token', repo: 'owner/site', branch: 'main', api: 'https://api.example', fetch: fake.fetch as typeof fetch });
  const store = memoryStore({ repo });
  const fixture = contentFixture();
  const chaii = fixture.content.projects.find((p) => p.slug === 'my-chaii-london') as Project;
  const path = 'content/projects/my-chaii-london.json';
  return { fake, repo, store, fixture, chaii, path };
}

async function saveDraft(store: ReturnType<typeof memoryStore>, project: Project, path: string, blobSha: string) {
  const etag = await store.drafts.put(project.id, draftOf(project, { path, blobSha }), null);
  return etag as string;
}

test('a publish reads HEAD, writes one tree and one commit, and moves the branch: in that order', async () => {
  const { fake, store, chaii, path, fixture } = setup();
  const etag = await saveDraft(store, { ...chaii, summary: 'Edited through the fake.' }, path, fixture.head.files[path]);
  const parent = fake.head;
  const outcome = await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  assert.equal(outcome.status, 200);
  const routes = fake.log.map((line) => line.replace(/[0-9a-f]{40}/g, '<sha>'));
  assert.deepEqual(routes, [
    'GET ref/heads/main',
    'GET commits/<sha>',
    'GET trees/<sha>',
    'GET trees/<sha>?recursive=1',
    'GET blobs/<sha>',
    'GET blobs/<sha>',
    'POST trees',
    'POST commits',
    'PATCH refs/heads/main',
  ]);
  const commit = fake.commits.get(fake.head);
  assert.deepEqual(commit?.parents, [parent]);
  assert.equal(commit?.message, `Publish: ${chaii.title} (edited)`);
  assert.deepEqual(fake.changedPaths(fake.head), [path]);
  assert.match(fake.blobText(fake.flatten()[path]) ?? '', /Edited through the fake\./);
  const latest = await store.meta.get<LatestPublish>(LATEST_KEY);
  assert.equal(latest?.commit, fake.head);
  assert.equal((await store.drafts.get(chaii.id))?.value.state, 'publishing');
});

test('when the branch moves during a publish (422 on the ref), it starts again from HEAD once', async () => {
  const { fake, store, chaii, path, fixture } = setup();
  const etag = await saveDraft(store, { ...chaii, summary: 'Second try.' }, path, fixture.head.files[path]);
  fake.failNext('PATCH', 422);
  const outcome = await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  assert.equal(outcome.status, 200);
  assert.equal(fake.log.filter((l) => l.startsWith('GET ref/')).length, 2);
  assert.equal(fake.log.filter((l) => l.startsWith('PATCH')).length, 2);
  assert.deepEqual(fake.changedPaths(fake.head), [path]);
});

test('a change someone else pushed to the same file is a conflict, not an overwrite', async () => {
  const { fake, store, chaii, path, fixture } = setup();
  const etag = await saveDraft(store, { ...chaii, summary: 'Mine.' }, path, fixture.head.files[path]);
  fake.moveHead(path, '{"changed": "elsewhere"}\n');
  const before = fake.head;
  const outcome = await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  assert.equal(outcome.status, 409);
  assert.equal(fake.head, before);
});

test('a draft changed since Publish was chosen is refused', async () => {
  const { store, chaii, path, fixture } = setup();
  await saveDraft(store, chaii, path, fixture.head.files[path]);
  const outcome = await publish(store, { items: [{ id: chaii.id, etag: 'old' }], home: null }, NOW);
  assert.deepEqual(outcome, { status: 409, body: { conflicts: [{ id: chaii.id, reason: 'Changed since you clicked Publish' }] } });
});

test('a media file that never finished uploading is refused before GitHub is asked', async () => {
  const { fake, store, chaii, path, fixture } = setup();
  const src = 'https://media.nihaalnazeer.com/p/11111111-1111-4111-8111-111111111111/cover-20261109120000-abc123.webp';
  const etag = await saveDraft(store, { ...chaii, cover: { kind: 'image', src, srcSmall: src, alt: 'A cover', width: 10, height: 10 } }, path, fixture.head.files[path]);
  const outcome = await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  assert.equal(outcome.status, 422);
  assert.deepEqual(outcome.body, { errors: { [chaii.id]: { cover: "This file didn't finish uploading: upload it again" } } });
  assert.equal(fake.log.length, 0);
});

test('GitHub refusing the token gives the plain message, without the token', async () => {
  const { fake, repo } = setup();
  fake.failNext('GET', 401);
  await assert.rejects(repo.readHead(), (error: unknown) => {
    assert.ok(error instanceof RepoError);
    assert.equal(error.message, 'The GitHub token was refused: make a new one (GO-LIVE.md)');
    assert.ok(!error.message.includes('test-token'));
    return true;
  });
  fake.failNext('GET', 503);
  await assert.rejects(repo.readHead(), /GitHub didn't answer\. Nothing was published/);
});

test('a publish is live once the deployed index holds its files; its draft then goes', async () => {
  const { fake, store, chaii, path, fixture } = setup();
  const etag = await saveDraft(store, { ...chaii, summary: 'Live soon.' }, path, fixture.head.files[path]);
  await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  const latest = (await store.meta.get<LatestPublish>(LATEST_KEY)) as LatestPublish;
  const later = new Date(NOW.getTime() + 60_000);

  const building = await settle(store, fixture.index, latest, await store.drafts.list(), later);
  assert.equal(building.build?.state, 'building');

  await store.meta.put(`builds/${latest.commit}.json`, { state: 'failed', at: later.toISOString(), step: 'npm run build', tail: 'Error' });
  const failed = await settle(store, fixture.index, latest, await store.drafts.list(), later);
  assert.equal(failed.build?.state, 'failed');
  assert.equal((await store.drafts.get(chaii.id))?.value.state, 'failed');

  const files = { ...fixture.index.files, [path]: { id: chaii.id, blobSha: fake.flatten()[path] } };
  const live = await settle(store, { ...fixture.index, files }, latest, await store.drafts.list(), later);
  assert.equal(live.build?.state, 'live');
  assert.equal(await store.drafts.get(chaii.id), null);
});

test('without a build report for 15 minutes, the publish is late', async () => {
  const { store, chaii, path, fixture } = setup();
  const etag = await saveDraft(store, { ...chaii, summary: 'Slow.' }, path, fixture.head.files[path]);
  await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  const latest = (await store.meta.get<LatestPublish>(LATEST_KEY)) as LatestPublish;
  const result = await settle(store, fixture.index, latest, await store.drafts.list(), new Date(NOW.getTime() + 16 * 60_000));
  assert.equal(result.build?.state, 'late');
});

test('a ref update whose answer is lost still counts once the branch shows it', async () => {
  const fake = createFakeGitHub(seedFrom(ROOT));
  let drop = true;
  const lossy = (async (input: string, init: RequestInit = {}) => {
    const response = await fake.fetch(input, init);
    if (init.method === 'PATCH' && drop) {
      drop = false;
      throw new TypeError('The connection was lost.');
    }
    return response;
  }) as typeof fetch;
  const repo = githubRepo({ token: 'test-token', repo: 'owner/site', branch: 'main', api: 'https://api.example', fetch: lossy });
  const store = memoryStore({ repo });
  const fixture = contentFixture();
  const chaii = fixture.content.projects.find((p) => p.slug === 'my-chaii-london') as Project;
  const path = 'content/projects/my-chaii-london.json';
  const etag = await saveDraft(store, { ...chaii, summary: 'The answer got lost.' }, path, fixture.head.files[path]);
  const outcome = await publish(store, { items: [{ id: chaii.id, etag }], home: null }, NOW);
  assert.equal(outcome.status, 200);
  assert.equal((await store.meta.get<LatestPublish>(LATEST_KEY))?.commit, fake.head);
  assert.equal((await store.drafts.get(chaii.id))?.value.state, 'publishing');
});

test('a ref update that GitHub refused with an error says nothing was published; one that cannot be checked says so', async () => {
  const { fake, repo } = setup();
  const head = await repo.readHead();
  fake.failNext('PATCH', 503);
  await assert.rejects(repo.commit(head, { writes: [{ path: 'content/home.json', content: '{}\n' }], deletes: [], message: 'x' }), /Nothing was published/);
  fake.failNext('PATCH', 503);
  fake.failNext('GET', 503, 1, 'ref/');
  await assert.rejects(repo.commit(head, { writes: [{ path: 'content/home.json', content: '{}\n' }], deletes: [], message: 'x' }), /isn't clear whether this was published/);
});

test('a publish made while the one before is still building is followed with it, and both settle when live', async () => {
  const { fake, store, chaii, path, fixture } = setup();
  const football = fixture.content.projects.find((p) => p.slug === 'football-on-the-vision-pro') as Project;
  const footballPath = 'content/projects/football-on-the-vision-pro.json';
  const first = await saveDraft(store, { ...chaii, summary: 'First.' }, path, fixture.head.files[path]);
  await publish(store, { items: [{ id: chaii.id, etag: first }], home: null }, NOW);
  const second = await saveDraft(store, { ...football, summary: 'Second.' }, footballPath, fixture.head.files[footballPath]);
  await publish(store, { items: [{ id: football.id, etag: second }], home: null }, new Date(NOW.getTime() + 30_000));

  const latest = (await store.meta.get<LatestPublish>(LATEST_KEY)) as LatestPublish;
  assert.equal(latest.commit, fake.head);
  assert.deepEqual(latest.items.map((i) => i.id).sort(), [chaii.id, football.id].sort());

  const flat = fake.flatten();
  const files = { ...fixture.index.files, [path]: { id: chaii.id, blobSha: flat[path] }, [footballPath]: { id: football.id, blobSha: flat[footballPath] } };
  const live = await settle(store, { ...fixture.index, files }, latest, await store.drafts.list(), new Date(NOW.getTime() + 300_000));
  assert.equal(live.build?.state, 'live');
  assert.equal(await store.drafts.get(chaii.id), null);
  assert.equal(await store.drafts.get(football.id), null);
});

test('a highlight waiting for a new project survives publishing the home page without that project', async () => {
  const { fake, store, chaii, fixture } = setup();
  const fresh = { ...chaii, id: '44444444-4444-4444-8444-444444444444', slug: 'waiting-one', title: 'Waiting one' };
  await store.drafts.put(fresh.id, draftOf(fresh, null), null);
  const idOf = (slug: string) => (fixture.content.projects.find((p) => p.slug === slug) as Project).id;
  const homeEtag = await store.homeDraft.put(
    {
      highlights: [...fixture.content.home.highlights.map(idOf), fresh.id],
      order: [...fixture.content.home.order.map(idOf), fresh.id],
      base: { blobSha: fixture.index.files['content/home.json'].blobSha },
      savedAt: NOW.toISOString(),
    },
    null,
  );
  const before = fake.head;
  const outcome = await publish(store, { items: [], home: homeEtag }, NOW);
  assert.deepEqual(outcome, { status: 200, body: { commit: null } });
  assert.equal(fake.head, before);
  assert.deepEqual((await store.homeDraft.get())?.value.highlights.at(-1), fresh.id);
});
