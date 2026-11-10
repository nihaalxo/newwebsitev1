import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALLOWED_PATH, CHANGED_ELSEWHERE, planPublish, publishedProject } from '@/lib/admin-api/plan';
import type { Draft, HomeLayout, Project, Redirects } from '@/lib/cms/types';
import { serializeProject } from '@/lib/content/serialize';
import { contentFixture, draftOf } from './memory-store';

const NEW_ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const fixture = contentFixture();
  const chaii = fixture.content.projects.find((p) => p.slug === 'my-chaii-london') as Project;
  const path = 'content/projects/my-chaii-london.json';
  const base = { path, blobSha: fixture.head.files[path] };
  const plan = (drafts: Draft[], homeDraft: { highlights: string[]; order: string[] } | null = null, head = fixture.head) =>
    planPublish({ index: fixture.index, head, drafts, homeDraft });
  return { fixture, chaii, path, base, plan };
}

const home = (text: string | undefined) => JSON.parse(text ?? 'null') as HomeLayout;
const redirects = (text: string | undefined) => JSON.parse(text ?? 'null') as Redirects;

test('a new project writes its file, joins the end of the order and is labelled new', async () => {
  const { chaii, plan, fixture } = setup();
  const draft = draftOf({ ...chaii, id: NEW_ID, slug: 'new-piece', title: 'New Piece', createdAt: '', updatedAt: '', publishedAt: null }, null);
  const result = await plan([draft]);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.errors, {});
  const file = result.writes.find((w) => w.path === 'content/projects/new-piece.json');
  assert.ok(file);
  assert.equal(file.content, serializeProject(publishedProject(draft)));
  const order = home(result.writes.find((w) => w.path === 'content/home.json')?.content).order;
  assert.equal(order.at(-1), 'new-piece');
  assert.equal(order.length, fixture.content.projects.length + 1);
  assert.match(result.message, /^Publish: New Piece \(new\)$/);
  assert.equal(result.items[0].path, 'content/projects/new-piece.json');
});

test('an edit rewrites only its file', async () => {
  const { chaii, base, plan, path } = setup();
  const result = await plan([draftOf({ ...chaii, summary: 'A new summary.' }, base)]);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(
    result.writes.map((w) => w.path),
    [path],
  );
  assert.deepEqual(result.deletes, []);
  assert.equal(result.message, `Publish: ${chaii.title} (edited)`);
  assert.equal(JSON.parse(result.writes[0].content).summary, 'A new summary.');
});

test('a rename moves the file, adds a 301 and rewrites redirects that pointed at the old address', async () => {
  const { chaii, base, plan, fixture, path } = setup();
  const head = { ...fixture.head, redirectsJson: '{\n  "/work/older": {\n    "to": "/work/my-chaii-london",\n    "status": 301\n  }\n}\n' };
  const result = await plan([draftOf({ ...chaii, slug: 'my-chaii' }, base)], null, head);
  assert.deepEqual(result.deletes, [path]);
  assert.ok(result.writes.some((w) => w.path === 'content/projects/my-chaii.json'));
  const rules = redirects(result.writes.find((w) => w.path === 'content/redirects.json')?.content);
  assert.deepEqual(rules['/work/my-chaii-london'], { to: '/work/my-chaii', status: 301 });
  assert.deepEqual(rules['/work/older'], { to: '/work/my-chaii', status: 301 });
  const layout = home(result.writes.find((w) => w.path === 'content/home.json')?.content);
  assert.ok(layout.order.includes('my-chaii') && !layout.order.includes('my-chaii-london'));
  assert.ok(layout.highlights.includes('my-chaii'));
  assert.match(result.message, /\(renamed\)/);
});

test('taking a project off the site removes its file and sends its address to All projects with a 302', async () => {
  const { chaii, base, plan, path } = setup();
  const result = await plan([draftOf(chaii, base, 'unpublish')]);
  assert.deepEqual(result.deletes, [path]);
  const rules = redirects(result.writes.find((w) => w.path === 'content/redirects.json')?.content);
  assert.deepEqual(rules['/work/my-chaii-london'], { to: '/work', status: 302, id: chaii.id });
  const layout = home(result.writes.find((w) => w.path === 'content/home.json')?.content);
  assert.ok(!layout.order.includes('my-chaii-london') && !layout.highlights.includes('my-chaii-london'));
  assert.equal(result.message, `Publish: ${chaii.title} (taken off the site)`);
  assert.equal(result.items[0].path, null);
});

test('deleting works the same way and says so', async () => {
  const { chaii, base, plan, path } = setup();
  const result = await plan([draftOf(chaii, base, 'delete')]);
  assert.deepEqual(result.deletes, [path]);
  assert.equal(result.message, `Publish: ${chaii.title} (deleted)`);
});

test('a project published again at an address that redirected loses the redirect', async () => {
  const { chaii, plan, fixture, path } = setup();
  const files = { ...fixture.head.files };
  delete files[path];
  const head = { ...fixture.head, files, redirectsJson: '{\n  "/work/my-chaii-london": {\n    "to": "/work",\n    "status": 302\n  }\n}\n' };
  const draft = { ...draftOf(chaii, null), state: 'hidden' as const };
  const result = await plan([draft], null, head);
  assert.deepEqual(redirects(result.writes.find((w) => w.path === 'content/redirects.json')?.content), {});
  assert.match(result.message, /\(back on the site\)/);
});

test('the home draft sets the order and highlights, written as slugs', async () => {
  const { plan, fixture } = setup();
  const ids = fixture.content.projects.map((p) => p.id);
  const reversed = [...ids].reverse();
  const result = await plan([], { highlights: [ids[5]], order: reversed });
  const layout = home(result.writes.find((w) => w.path === 'content/home.json')?.content);
  assert.deepEqual(layout.order, [...fixture.content.projects].reverse().map((p) => p.slug));
  assert.deepEqual(layout.highlights, [fixture.content.projects[5].slug]);
  assert.equal(result.message, 'Publish: Home page (order and highlights)');
});

test('at most three highlights are written', async () => {
  const { plan, fixture } = setup();
  const ids = fixture.content.projects.map((p) => p.id);
  const result = await plan([], { highlights: ids.slice(0, 4), order: ids });
  const layout = home(result.writes.find((w) => w.path === 'content/home.json')?.content);
  assert.equal(layout.highlights.length, 3);
});

test('a draft whose file changed on the site since it began is a conflict', async () => {
  const { chaii, plan, path } = setup();
  const result = await plan([draftOf({ ...chaii, summary: 'Mine.' }, { path, blobSha: '0'.repeat(40) })]);
  assert.deepEqual(result.conflicts, [{ id: chaii.id, reason: CHANGED_ELSEWHERE }]);
});

test('a publish tried again after it went through is not a conflict and writes nothing new', async () => {
  const { chaii, base, plan, fixture, path, } = setup();
  const draft = draftOf({ ...chaii, summary: 'Published once already.' }, base);
  const first = await plan([draft]);
  const after = { ...fixture.head, files: { ...fixture.head.files } };
  for (const change of first.changes) after.files[change.path] = change.after as string;
  const home = first.writes.find((w) => w.path === 'content/home.json');
  const again = await plan([draft], null, { ...after, homeJson: home?.content ?? fixture.head.homeJson });
  assert.deepEqual(again.conflicts, []);
  assert.deepEqual(again.writes, []);
  assert.deepEqual(again.deletes, []);
  assert.ok(first.changes.some((c) => c.path === path));
});

test('only content files may be written or deleted', async () => {
  const { chaii, plan, fixture } = setup();
  assert.ok(ALLOWED_PATH.test('content/projects/a-b.json'));
  assert.ok(ALLOWED_PATH.test('content/home.json'));
  assert.ok(!ALLOWED_PATH.test('package.json'));
  assert.ok(!ALLOWED_PATH.test('content/projects/../x.json'));
  assert.ok(!ALLOWED_PATH.test('content/projects/sub/x.json'));
  const head = { ...fixture.head, files: { ...fixture.head.files, 'package.json': 'a'.repeat(40) } };
  await assert.rejects(plan([draftOf(chaii, { path: 'package.json', blobSha: 'a'.repeat(40) }, 'delete')], null, head), /only change content files/);
});

test('a web address another project uses is refused', async () => {
  const { chaii, base, plan } = setup();
  const result = await plan([draftOf({ ...chaii, slug: 'football-on-the-vision-pro' }, base)]);
  assert.ok(result.errors[chaii.id]?.slug);
});

/** HEAD after a plan's commit. */
function applied(head: ReturnType<typeof setup>['fixture']['head'], result: Awaited<ReturnType<ReturnType<typeof setup>['plan']>>) {
  const files = { ...head.files };
  for (const change of result.changes) {
    if (change.after) files[change.path] = change.after;
    else delete files[change.path];
  }
  const text = (path: string) => result.writes.find((w) => w.path === path)?.content;
  return { ...head, files, homeJson: text('content/home.json') ?? head.homeJson, redirectsJson: text('content/redirects.json') ?? head.redirectsJson };
}

test('renamed, taken off, then published again: the old addresses lead to the project again', async () => {
  const { chaii, base, plan, fixture } = setup();
  const renamed = await plan([draftOf({ ...chaii, slug: 'my-chaii' }, base)]);
  const head1 = applied(fixture.head, renamed);
  const newPath = 'content/projects/my-chaii.json';

  const off = await plan([draftOf({ ...chaii, slug: 'my-chaii' }, { path: newPath, blobSha: head1.files[newPath] }, 'unpublish')], null, head1);
  const head2 = applied(head1, off);
  // While it is off the site: both addresses go to All projects with a 302, which browsers don't keep.
  assert.deepEqual(redirects(head2.redirectsJson), {
    '/work/my-chaii': { to: '/work', status: 302, id: chaii.id },
    '/work/my-chaii-london': { to: '/work', status: 302, id: chaii.id },
  });

  const back = await plan([{ ...draftOf({ ...chaii, slug: 'my-chaii' }, null), state: 'hidden' as const }], null, head2);
  assert.deepEqual(back.conflicts, []);
  const head3 = applied(head2, back);
  assert.deepEqual(redirects(head3.redirectsJson), { '/work/my-chaii-london': { to: '/work/my-chaii', status: 301 } });
});
