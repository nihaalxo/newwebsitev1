import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/*
 * The two Cloudflare bindings the CMS uses, typed by hand with only the calls it makes, so the project doesn't need
 * @cloudflare/workers-types (whose globals clash with the DOM's). wrangler.jsonc declares both bindings.
 */

export interface CmsD1Result<T> {
  results: T[];
  success: boolean;
  meta: { changes?: number };
}

export interface CmsD1Statement {
  bind(...values: unknown[]): CmsD1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<CmsD1Result<T>>;
  run(): Promise<CmsD1Result<unknown>>;
}

export interface CmsD1Database {
  prepare(query: string): CmsD1Statement;
  /** Runs every statement in one transaction: all of them apply, or none does. */
  batch(statements: CmsD1Statement[]): Promise<CmsD1Result<unknown>[]>;
}

export type CmsR2Range = { offset: number; length?: number } | { suffix: number };

export interface CmsR2Object {
  key: string;
  size: number;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  range?: CmsR2Range;
}

export interface CmsR2ObjectBody extends CmsR2Object {
  body: ReadableStream;
}

export interface CmsR2Bucket {
  head(key: string): Promise<CmsR2Object | null>;
  get(key: string, options?: { range?: CmsR2Range }): Promise<CmsR2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<CmsR2Object | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface CmsCloudflareEnv {
  CMS_DB: CmsD1Database;
  CMS_UPLOADS: CmsR2Bucket;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  LOCAL_SESSION_SECRET?: string;
}

/** Uploads live in R2 under this prefix and are served by app/cms/[...path]/route.ts at /cms/<path>. */
export const R2_PREFIX = 'cms/';
export const R2_PUBLIC_PREFIX = '/cms/';

/**
 * The Worker's bindings when this request is running on Cloudflare (deployed, or the OpenNext preview) with the CMS
 * database bound; otherwise null. Never throws: outside a Cloudflare request getCloudflareContext() does, so this is
 * only ever called while handling one.
 */
export function cloudflareEnv(): CmsCloudflareEnv | null {
  try {
    const env = getCloudflareContext().env as unknown as Partial<CmsCloudflareEnv>;
    return env.CMS_DB ? (env as CmsCloudflareEnv) : null;
  } catch {
    return null;
  }
}
