import { HOME_PATH, REDIRECTS_PATH } from '@/lib/content/serialize';
import { RepoError, RepoMoved, type Repo, type RepoChange, type RepoHead } from './store';

/*
 * Publishing is one commit to the repository's main branch, made through GitHub's git data API with a fine-grained
 * token that can write the repository's contents (GITHUB_TOKEN). Workers Builds sees the push and deploys it.
 * A publish reads HEAD (ref, commit, root tree, content tree, home.json, redirects.json), writes one tree and one
 * commit, then moves the branch without forcing: about 9 calls. The token never leaves this module: it is not
 * logged and not put in any answer.
 */

export interface GitHubConfig {
  token: string;
  /** "owner/name" */
  repo: string;
  branch: string;
  /** https://api.github.com, or a stand-in for tests. */
  api?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const TOKEN_REFUSED = 'The GitHub token was refused: make a new one (GO-LIVE.md)';
const NO_ANSWER = "GitHub didn't answer. Nothing was published. Try again in a few minutes";

type GitTreeEntry = { path: string; mode: string; type: string; sha: string };

export function githubRepo(config: GitHubConfig): Repo {
  const api = (config.api ?? 'https://api.github.com').replace(/\/+$/, '');
  const base = `${api}/repos/${config.repo}`;
  const doFetch = config.fetch ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${base}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'nihaalnazeer-admin',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs ?? 15000),
      });
    } catch {
      throw new RepoError(NO_ANSWER, 504);
    }
    if (response.ok) return (await response.json()) as T;
    // Read and drop the body, so nothing GitHub said (or the request) ends up in a message.
    await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) throw new RepoError(TOKEN_REFUSED, response.status);
    if (method === 'PATCH' && (response.status === 422 || response.status === 409)) throw new RepoMoved();
    if (response.status >= 500 || response.status === 429) throw new RepoError(NO_ANSWER, response.status);
    throw new RepoError(`GitHub refused the publish (error ${response.status}). Nothing was published.`, response.status);
  }

  const refPath = `git/ref/heads/${config.branch}`;
  const refsPath = `git/refs/heads/${config.branch}`;

  async function head(): Promise<{ commit: string; tree: string }> {
    const ref = await call<{ object: { sha: string } }>('GET', refPath);
    const commit = await call<{ sha: string; tree: { sha: string } }>('GET', `git/commits/${ref.object.sha}`);
    return { commit: ref.object.sha, tree: commit.tree.sha };
  }

  async function blobText(sha: string): Promise<string> {
    const blob = await call<{ content: string; encoding: string }>('GET', `git/blobs/${sha}`);
    if (blob.encoding !== 'base64') return blob.content;
    const binary = atob(blob.content.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  }

  async function newCommit(parent: string, tree: string, message: string): Promise<string> {
    const commit = await call<{ sha: string }>('POST', 'git/commits', { message, tree, parents: [parent] });
    await call('PATCH', refsPath, { sha: commit.sha, force: false });
    return commit.sha;
  }

  return {
    async readHead(): Promise<RepoHead> {
      const { commit, tree } = await head();
      const root = await call<{ tree: GitTreeEntry[] }>('GET', `git/trees/${tree}`);
      const content = root.tree.find((entry) => entry.path === 'content' && entry.type === 'tree');
      const files: Record<string, string> = {};
      if (content) {
        const listing = await call<{ tree: GitTreeEntry[]; truncated: boolean }>('GET', `git/trees/${content.sha}?recursive=1`);
        if (listing.truncated) throw new RepoError('The content folder is too big for one listing. Nothing was published.', 500);
        for (const entry of listing.tree) if (entry.type === 'blob') files[`content/${entry.path}`] = entry.sha;
      }
      const [homeJson, redirectsJson] = await Promise.all([
        files[HOME_PATH] ? blobText(files[HOME_PATH]) : Promise.resolve('{"highlights":[],"order":[]}\n'),
        files[REDIRECTS_PATH] ? blobText(files[REDIRECTS_PATH]) : Promise.resolve('{}\n'),
      ]);
      return { commit, tree, files, homeJson, redirectsJson };
    },

    async commit(at: RepoHead, change: RepoChange): Promise<string> {
      const entries = [
        ...change.writes.map(({ path, content }) => ({ path, mode: '100644', type: 'blob', content })),
        ...change.deletes.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
      ];
      const tree = await call<{ sha: string }>('POST', 'git/trees', { base_tree: at.tree, tree: entries });
      return newCommit(at.commit, tree.sha, change.message);
    },

    async emptyCommit(message: string): Promise<string> {
      const { commit, tree } = await head();
      return newCommit(commit, tree, message);
    },

    async restore(at: RepoHead, entries: { path: string; blobSha: string | null }[], message: string): Promise<string> {
      const tree = await call<{ sha: string }>('POST', 'git/trees', {
        base_tree: at.tree,
        tree: entries.map(({ path, blobSha }) => ({ path, mode: '100644', type: 'blob', sha: blobSha })),
      });
      return newCommit(at.commit, tree.sha, message);
    },
  };
}
