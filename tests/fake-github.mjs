#!/usr/bin/env node
// A stand-in for GitHub's git data API, in memory, for the tests and for trying the live admin under
// `npm run preview` without GitHub. It answers the 7 calls lib/admin-api/github.ts makes:
//   GET   /repos/<owner>/<name>/git/ref/heads/<branch>
//   GET   /repos/<owner>/<name>/git/commits/<sha>
//   GET   /repos/<owner>/<name>/git/trees/<sha>[?recursive=1]
//   GET   /repos/<owner>/<name>/git/blobs/<sha>
//   POST  /repos/<owner>/<name>/git/trees
//   POST  /repos/<owner>/<name>/git/commits
//   PATCH /repos/<owner>/<name>/git/refs/heads/<branch>   (422 unless it moves the branch forward)
// and a few of its own under /_fake/ for the checks: GET state, GET files?commit=<sha>, POST fail-next
// { method, status, times }, POST move-head { path, content }.
//
// As a server: node tests/fake-github.mjs <port>, seeded with this checkout's content/ folder. Never a real token:
// it accepts any Authorization header and stores nothing outside memory.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha1 = (...parts) => {
  const hash = createHash('sha1');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
};

/** A fake repository whose branch starts with `files` (path -> text) in one commit. */
export function createFakeGitHub(files, { branch = 'main' } = {}) {
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const failures = [];
  const log = [];
  let head = null;

  function putBlob(content) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const sha = sha1(`blob ${bytes.length}\0`, bytes);
    blobs.set(sha, bytes);
    return sha;
  }

  /** Builds nested trees from path -> blob sha; returns the root tree's sha. */
  function putTree(flat) {
    const entries = new Map();
    const children = new Map();
    for (const [file, sha] of Object.entries(flat)) {
      const [first, ...rest] = file.split('/');
      if (rest.length === 0) entries.set(first, { path: first, mode: '100644', type: 'blob', sha });
      else {
        if (!children.has(first)) children.set(first, {});
        children.get(first)[rest.join('/')] = sha;
      }
    }
    for (const [name, sub] of children) entries.set(name, { path: name, mode: '040000', type: 'tree', sha: putTree(sub) });
    const list = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
    const sha = sha1('tree ', JSON.stringify(list));
    trees.set(sha, list);
    return sha;
  }

  /** path -> blob sha for every file under a tree. */
  function flatten(treeSha, prefix = '') {
    const out = {};
    for (const entry of trees.get(treeSha) ?? []) {
      const full = prefix ? `${prefix}/${entry.path}` : entry.path;
      if (entry.type === 'tree') Object.assign(out, flatten(entry.sha, full));
      else out[full] = entry.sha;
    }
    return out;
  }

  function putCommit(tree, parents, message) {
    const sha = sha1('commit ', JSON.stringify({ tree, parents, message, n: commits.size }));
    commits.set(sha, { sha, tree, parents, message });
    return sha;
  }

  const seed = {};
  for (const [file, text] of Object.entries(files)) seed[file] = putBlob(text);
  head = putCommit(putTree(seed), [], 'Seed');

  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

  /** Changed paths between a commit and its parent. */
  function changedPaths(sha) {
    const commit = commits.get(sha);
    const parent = commit.parents[0] ? commits.get(commit.parents[0]) : null;
    const before = parent ? flatten(parent.tree) : {};
    const after = flatten(commit.tree);
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((p) => before[p] !== after[p]).sort();
  }

  async function handle(method, url, body) {
    const { pathname, searchParams } = url;

    // ---- the fake's own controls
    if (pathname === '/_fake/state') {
      const history = [];
      for (let sha = head; sha; sha = commits.get(sha).parents[0]) {
        const c = commits.get(sha);
        history.push({ sha, parents: c.parents, message: c.message, paths: changedPaths(sha) });
      }
      return json(200, { head, branch, commits: history, log });
    }
    if (pathname === '/_fake/files') {
      const commit = commits.get(searchParams.get('commit') ?? head);
      if (!commit) return json(404, { message: 'Not Found' });
      const out = {};
      for (const [file, sha] of Object.entries(flatten(commit.tree))) out[file] = blobs.get(sha).toString('utf8');
      return json(200, out);
    }
    if (pathname === '/_fake/fail-next' && method === 'POST') {
      failures.push({ method: body.method ?? 'PATCH', status: body.status ?? 422, times: body.times ?? 1, match: body.match ?? '' });
      return json(200, { ok: true });
    }
    if (pathname === '/_fake/move-head' && method === 'POST') {
      const flat = flatten(commits.get(head).tree);
      flat[body.path ?? 'README.md'] = putBlob(body.content ?? `moved ${Date.now()}\n`);
      head = putCommit(putTree(flat), [head], body.message ?? 'Someone else pushed');
      return json(200, { head });
    }

    // ---- GitHub
    const match = pathname.match(/^\/repos\/[^/]+\/[^/]+\/git\/(.+)$/);
    if (!match) return json(404, { message: 'Not Found' });
    const route = match[1];
    log.push(`${method} ${route}${url.search}`);

    const failure = failures.find((f) => f.method === method && route.includes(f.match) && f.times > 0);
    if (failure) {
      failure.times -= 1;
      return json(failure.status, { message: 'Forced failure' });
    }

    if (method === 'GET' && route === `ref/heads/${branch}`) return json(200, { ref: `refs/heads/${branch}`, object: { sha: head, type: 'commit' } });
    let m;
    if (method === 'GET' && (m = route.match(/^commits\/([0-9a-f]{40})$/))) {
      const c = commits.get(m[1]);
      return c ? json(200, { sha: c.sha, tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })), message: c.message }) : json(404, { message: 'Not Found' });
    }
    if (method === 'GET' && (m = route.match(/^trees\/([0-9a-f]{40})$/))) {
      if (!trees.has(m[1])) return json(404, { message: 'Not Found' });
      if (searchParams.get('recursive') === '1') {
        const tree = Object.entries(flatten(m[1])).map(([p, sha]) => ({ path: p, mode: '100644', type: 'blob', sha }));
        return json(200, { sha: m[1], tree, truncated: false });
      }
      return json(200, { sha: m[1], tree: trees.get(m[1]), truncated: false });
    }
    if (method === 'GET' && (m = route.match(/^blobs\/([0-9a-f]{40})$/))) {
      const bytes = blobs.get(m[1]);
      return bytes ? json(200, { sha: m[1], content: bytes.toString('base64'), encoding: 'base64', size: bytes.length }) : json(404, { message: 'Not Found' });
    }
    if (method === 'POST' && route === 'trees') {
      const flat = body.base_tree ? flatten(body.base_tree) : {};
      for (const entry of body.tree ?? []) {
        if (typeof entry.content === 'string') flat[entry.path] = putBlob(entry.content);
        else if (entry.sha === null) delete flat[entry.path];
        else if (blobs.has(entry.sha)) flat[entry.path] = entry.sha;
        else return json(422, { message: `Unknown blob ${entry.sha}` });
      }
      return json(201, { sha: putTree(flat) });
    }
    if (method === 'POST' && route === 'commits') {
      if (!trees.has(body.tree) || !(body.parents ?? []).every((p) => commits.has(p))) return json(422, { message: 'Bad tree or parent' });
      return json(201, { sha: putCommit(body.tree, body.parents, body.message) });
    }
    if (method === 'PATCH' && route === `refs/heads/${branch}`) {
      const next = commits.get(body.sha);
      if (!next) return json(422, { message: 'Unknown commit' });
      if (!body.force && next.parents[0] !== head) return json(422, { message: 'Update is not a fast forward' });
      head = body.sha;
      return json(200, { ref: `refs/heads/${branch}`, object: { sha: head, type: 'commit' } });
    }
    return json(404, { message: 'Not Found' });
  }

  return {
    get head() {
      return head;
    },
    log,
    commits,
    flatten: (sha = head) => flatten(commits.get(sha).tree),
    blobText: (sha) => blobs.get(sha)?.toString('utf8') ?? null,
    changedPaths,
    failNext: (method, status, times = 1, match = '') => failures.push({ method, status, times, match }),
    moveHead(file = 'README.md', content = `moved ${Date.now()}\n`) {
      const flat = flatten(commits.get(head).tree);
      flat[file] = putBlob(content);
      head = putCommit(putTree(flat), [head], 'Someone else pushed');
      return head;
    },
    /** A fetch() for lib/admin-api/github.ts. */
    async fetch(input, init = {}) {
      const url = new URL(typeof input === 'string' ? input : input.url);
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(init.body) : {};
      return handle(method, url, body);
    },
    handle,
  };
}

/** content/** of a checkout, plus one file outside it, as the fake's first commit. */
export function seedFrom(root) {
  const files = { 'package.json': readFileSync(path.join(root, 'package.json'), 'utf8') };
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join('/')] = readFileSync(full, 'utf8');
    }
  })(path.join(root, 'content'));
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.argv[2] ?? 4830);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const fake = createFakeGitHub(seedFrom(root));
  createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    const response = await fake.handle(req.method ?? 'GET', new URL(req.url ?? '/', `http://127.0.0.1:${port}`), body);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, '127.0.0.1', () => console.log(`fake GitHub on http://127.0.0.1:${port}, head ${fake.head}`));
}
