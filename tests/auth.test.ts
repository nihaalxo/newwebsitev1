import assert from 'node:assert/strict';
import { test } from 'node:test';
import { THROTTLE, isSignedIn, rotateSessionKey, signIn, signSession, verifySession } from '@/lib/admin-api/auth';
import { memoryStore } from './memory-store';

const T0 = Date.parse('2026-11-09T12:00:00Z');
const cookieValue = (cookie: string) => cookie.split(';')[0].split('=').slice(1).join('=');
const withCookie = (value: string) => new Request('https://nihaalnazeer.com/api/admin/state', { headers: { cookie: `__Host-nn_admin=${value}` } });

test('a signed session verifies until it expires, and a changed one never does', async () => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const value = await signSession(key, T0 + 1000);
  assert.equal(await verifySession(key, value, T0), true);
  assert.equal(await verifySession(key, value, T0 + 1000), false);
  const [payload, signature] = value.split('.');
  const forged = `${Buffer.from(JSON.stringify({ exp: T0 + 9e9 })).toString('base64url')}.${signature}`;
  assert.equal(await verifySession(key, forged, T0), false);
  assert.equal(await verifySession(key, `${payload}.${signature}x`, T0), false);
  assert.equal(await verifySession(crypto.getRandomValues(new Uint8Array(32)), value, T0), false);
});

test('signing in sets a Secure, HttpOnly, SameSite=Strict cookie for 7 days', async () => {
  const store = memoryStore();
  const result = await signIn(store, 'correct horse', '1.2.3.4', T0);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.cookie, /^__Host-nn_admin=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=604800$/);
  assert.equal(await isSignedIn(store, withCookie(cookieValue(result.cookie)), T0 + 1000), true);
  assert.equal(await isSignedIn(store, withCookie(cookieValue(result.cookie)), T0 + 7 * 86400e3 + 1), false);
  await rotateSessionKey(store);
  assert.equal(await isSignedIn(store, withCookie(cookieValue(result.cookie)), T0 + 1000), false);
});

test('no password set means nobody signs in', async () => {
  const store = memoryStore({ password: '' });
  store.config.adminPassword = undefined;
  assert.deepEqual(await signIn(store, '', '1.2.3.4', T0), { ok: false, retryAfter: 0 });
  assert.deepEqual(await signIn(store, 'anything', '1.2.3.4', T0 + 1), { ok: false, retryAfter: 0 });
});

test('five wrong passwords lock that address for 15 minutes; others can still sign in', async () => {
  const store = memoryStore();
  for (let i = 0; i < THROTTLE.perIp; i++) assert.deepEqual(await signIn(store, 'wrong', '1.2.3.4', T0 + i), { ok: false, retryAfter: 0 });
  const sixth = await signIn(store, 'correct horse', '1.2.3.4', T0 + 10);
  assert.equal(sixth.ok, false);
  assert.ok(!sixth.ok && sixth.retryAfter > 14 * 60 && sixth.retryAfter <= 15 * 60);
  assert.equal((await signIn(store, 'correct horse', '5.6.7.8', T0 + 11)).ok, true);
  assert.equal((await signIn(store, 'correct horse', '1.2.3.4', T0 + 4 + THROTTLE.ipWindowMs + 1)).ok, true);
});

test('fifty failures in an hour pause sign-in for everyone until the hour ends', async () => {
  const store = memoryStore();
  for (let i = 0; i < THROTTLE.global; i++) await signIn(store, 'wrong', `10.0.${Math.floor(i / 4)}.${i % 4}`, T0 + i);
  const blocked = await signIn(store, 'correct horse', '9.9.9.9', T0 + 100);
  assert.equal(blocked.ok, false);
  assert.equal((await signIn(store, 'correct horse', '9.9.9.9', T0 + THROTTLE.globalWindowMs + 1)).ok, true);
});

test('writes are refused unless their Origin is the address they were sent to', async () => {
  const { handleAdminApi } = await import('@/lib/admin-api/handler');
  const store = memoryStore();
  const signInFrom = (url: string, headers: Record<string, string>) =>
    handleAdminApi(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ password: 'wrong' }) }), store);

  const foreign = await signInFrom('https://nihaalnazeer.com/api/admin/session', { origin: 'https://elsewhere.example' });
  assert.equal(foreign.status, 403);
  const missing = await signInFrom('https://nihaalnazeer.com/api/admin/session', {});
  assert.equal(missing.status, 403);
  const own = await signInFrom('https://nihaalnazeer.com/api/admin/session', { origin: 'https://nihaalnazeer.com' });
  assert.equal(own.status, 401);
  // next dev hands the route localhost as its host; the Host header holds the address the browser used.
  const dev = await signInFrom('http://localhost:3000/api/admin/session', { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' });
  assert.equal(dev.status, 401);
  const devForeign = await signInFrom('http://localhost:3000/api/admin/session', { origin: 'http://elsewhere.example', host: '127.0.0.1:3000' });
  assert.equal(devForeign.status, 403);
});
