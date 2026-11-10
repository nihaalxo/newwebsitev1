// Types for tests/fake-github.mjs, as the tests use it.
export interface FakeGitHub {
  readonly head: string;
  log: string[];
  commits: Map<string, { sha: string; tree: string; parents: string[]; message: string }>;
  flatten(sha?: string): Record<string, string>;
  blobText(sha: string): string | null;
  changedPaths(sha: string): string[];
  failNext(method: string, status: number, times?: number, match?: string): void;
  moveHead(file?: string, content?: string): string;
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}
export function createFakeGitHub(files: Record<string, string>, options?: { branch?: string }): FakeGitHub;
export function seedFrom(root: string): Record<string, string>;
