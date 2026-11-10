import type { Store } from './store';

/*
 * Signing in to the admin. One password (the ADMIN_PASSWORD secret), compared as SHA-256 hashes in constant time:
 * cheap enough for the Free plan's 10 ms of CPU, where PBKDF2 would not be. A session is a signed cookie holding
 * only its expiry. Cookies are signed with a key made from a random key in the admin bucket and the password, so
 * signing out (which replaces the random key) or changing ADMIN_PASSWORD makes every cookie stop working.
 */

export const SESSION_DAYS = 7;
const SESSION_KEY = 'auth/session-key';
const FAILURES_KEY = 'auth/failures.json';

export const THROTTLE = {
  /** Tries from one address (an IPv6 /64 counts as one) within the window before it is locked out for the window. */
  perIp: 5,
  ipWindowMs: 15 * 60 * 1000,
  /**
   * Tries recorded in an hour from everywhere. Past it no more are written, which keeps a flood of tries from
   * running up R2 writes; nobody is locked out by it, so it can't be used to keep the right password out.
   */
  recordsPerHour: 300,
  globalWindowMs: 60 * 60 * 1000,
} as const;

interface Failures {
  ips: Record<string, { count: number; since: number; lockedUntil?: number }>;
  global: { count: number; since: number };
}

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(text: string): Uint8Array | null {
  try {
    const plain = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(plain, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** Compares every byte, so the time taken says nothing about where two values differ. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function passwordMatches(input: string, password: string | undefined): Promise<boolean> {
  if (!password) return false;
  const [given, wanted] = await Promise.all([sha256(input), sha256(password)]);
  return sameBytes(given, wanted);
}

async function hmacKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** The key cookies are signed with: the stored random key, bound to the password. */
async function signingKey(raw: Uint8Array, password: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(raw), encoder.encode(`session:${password}`)));
}

/** The key that signs sessions, made at the first sign-in. */
async function sessionKey(store: Store, create: boolean): Promise<Uint8Array | null> {
  const stored = await store.meta.get<string>(SESSION_KEY);
  const raw = stored ? fromBase64url(stored) : null;
  if (raw && raw.byteLength === 32) return raw;
  if (!create) return null;
  return rotateSessionKey(store);
}

export async function rotateSessionKey(store: Store): Promise<Uint8Array> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  await store.meta.put(SESSION_KEY, base64url(raw));
  return raw;
}

/** "<base64url {exp}>.<base64url HMAC>" */
export async function signSession(key: Uint8Array, expiresAt: number): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ exp: expiresAt })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(key), encoder.encode(payload)));
  return `${payload}.${base64url(signature)}`;
}

/** True when the value was signed with `key` and hasn't expired. */
export async function verifySession(key: Uint8Array, value: string, now: number): Promise<boolean> {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return false;
  const sig = fromBase64url(signature);
  if (!sig) return false;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(key), sig, encoder.encode(payload));
  if (!valid) return false;
  try {
    const body = JSON.parse(new TextDecoder().decode(fromBase64url(payload) ?? new Uint8Array()));
    return typeof body.exp === 'number' && body.exp > now;
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function sessionCookie(store: Store, value: string, maxAge: number): string {
  const { cookieName, secureCookie } = store.config;
  return [`${cookieName}=${value}`, 'HttpOnly', ...(secureCookie ? ['Secure'] : []), 'SameSite=Strict', 'Path=/', `Max-Age=${maxAge}`].join('; ');
}

export async function isSignedIn(store: Store, request: Request, now = Date.now()): Promise<boolean> {
  const value = readCookie(request, store.config.cookieName);
  const password = store.config.adminPassword;
  if (!value || !password) return false;
  const key = await sessionKey(store, false);
  return key ? verifySession(await signingKey(key, password), value, now) : false;
}

/** A new session cookie, made after the password matched. */
export async function startSession(store: Store, now = Date.now()): Promise<string> {
  const key = (await sessionKey(store, true)) as Uint8Array;
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const signing = await signingKey(key, store.config.adminPassword ?? '');
  return sessionCookie(store, await signSession(signing, now + maxAge * 1000), maxAge);
}

export function endSessionCookie(store: Store): string {
  return sessionCookie(store, '', 0);
}

// ---------------------------------------------------------------- throttle

/** The address a try is counted against: an IPv4 address, or the /64 network of an IPv6 one. */
export function addressKey(ip: string): string {
  if (!ip.includes(':') || ip.includes('.')) return ip;
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g, 16) || 0).toString(16))
    .join(':')}::/64`;
}

function freshFailures(failures: Failures | null, now: number): Failures {
  const state: Failures = failures && typeof failures === 'object' ? structuredClone(failures) : { ips: {}, global: { count: 0, since: now } };
  if (!state.global || now - state.global.since >= THROTTLE.globalWindowMs) state.global = { count: 0, since: now };
  const ips: Failures['ips'] = {};
  for (const [ip, entry] of Object.entries(state.ips ?? {})) {
    const active = (entry.lockedUntil ?? 0) > now || now - entry.since < THROTTLE.ipWindowMs;
    if (active) ips[ip] = entry;
  }
  state.ips = ips;
  return state;
}

/** Seconds until `ip` may try again, or 0 when it may try now. */
export function retryAfter(failures: Failures | null, ip: string, now: number): number {
  const lockedUntil = freshFailures(failures, now).ips[ip]?.lockedUntil ?? 0;
  return lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;
}

/** Counts one try from `ip`. */
export function recordFailure(failures: Failures | null, ip: string, now: number): Failures {
  const state = freshFailures(failures, now);
  state.global.count += 1;
  const entry = state.ips[ip] && now - state.ips[ip].since < THROTTLE.ipWindowMs ? state.ips[ip] : { count: 0, since: now };
  entry.count += 1;
  if (entry.count >= THROTTLE.perIp) entry.lockedUntil = now + THROTTLE.ipWindowMs;
  state.ips[ip] = entry;
  return state;
}

export type SignInResult = { ok: true; cookie: string } | { ok: false; retryAfter: number };

/**
 * Checks the password, with the throttle. retryAfter 0 means simply the wrong password.
 *
 * Each try is counted before its password is checked, with a write that only lands if nobody else wrote in
 * between. A try that loses that race is told to try again in a second, unchecked, so a burst of tries at once
 * checks no more passwords than the throttle allows.
 */
export async function signIn(store: Store, password: string, ip: string, now = Date.now()): Promise<SignInResult> {
  const address = addressKey(ip);
  const stored = await store.meta.getStored<Failures>(FAILURES_KEY);
  const failures = stored?.value ?? null;
  const wait = retryAfter(failures, address, now);
  if (wait > 0) return { ok: false, retryAfter: wait };
  if (freshFailures(failures, now).global.count < THROTTLE.recordsPerHour) {
    const counted = await store.meta.putIf(FAILURES_KEY, recordFailure(failures, address, now), stored?.etag ?? null);
    if (!counted) return { ok: false, retryAfter: 1 };
  }
  if (!(await passwordMatches(password, store.config.adminPassword))) return { ok: false, retryAfter: 0 };
  // Signed in: this address starts again from nothing.
  const after = await store.meta.getStored<Failures>(FAILURES_KEY);
  if (after?.value?.ips?.[address]) {
    const state = freshFailures(after.value, now);
    delete state.ips[address];
    await store.meta.putIf(FAILURES_KEY, state, after.etag);
  }
  return { ok: true, cookie: await startSession(store, now) };
}
