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
