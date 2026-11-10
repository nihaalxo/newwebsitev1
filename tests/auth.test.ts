import assert from 'node:assert/strict';
import { test } from 'node:test';
import { THROTTLE, addressKey, isSignedIn, rotateSessionKey, signIn, signSession, verifySession } from '@/lib/admin-api/auth';
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

test('a burst of tries at once checks no more passwords than the throttle allows', async () => {
  const store = memoryStore();
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => signIn(store, 'wrong', '1.2.3.4', T0 + i)));
  const checked = results.filter((r) => !r.ok && r.retryAfter === 0).length;
  assert.ok(checked >= 1 && checked <= THROTTLE.perIp, `${checked} passwords checked`);
  const again = await Promise.all(Array.from({ length: 50 }, (_, i) => signIn(store, 'wrong', '1.2.3.4', T0 + 100 + i)));
  const total = checked + again.filter((r) => !r.ok && r.retryAfter === 0).length;
  assert.ok(total <= THROTTLE.perIp, `${total} passwords checked`);
});

test('one IPv6 /64 counts as one address', () => {
  assert.equal(addressKey('2001:db8:1:2::1'), addressKey('2001:db8:1:2:ffff:0:0:b'));
  assert.notEqual(addressKey('2001:db8:1:2::1'), addressKey('2001:db8:1:3::1'));
  assert.equal(addressKey('203.0.113.9'), '203.0.113.9');
});

test('many failures in an hour never keep the right password out; past the record limit nothing more is written', async () => {
  const store = memoryStore();
  for (let i = 0; i < THROTTLE.recordsPerHour + 20; i++) await signIn(store, 'wrong', `10.${Math.floor(i / 250)}.${i % 250}.1`, T0 + i);
  const before = await store.meta.getStored('auth/failures.json');
  await signIn(store, 'wrong', '10.9.9.9', T0 + 1000);
  assert.equal((await store.meta.getStored('auth/failures.json'))?.etag, before?.etag);
  assert.equal((await signIn(store, 'correct horse', '9.9.9.9', T0 + 1001)).ok, true);
});

test('changing the password, or signing out, ends every session', async () => {
  const store = memoryStore();
  const first = await signIn(store, 'correct horse', '1.2.3.4', T0);
  assert.ok(first.ok);
  if (!first.ok) return;
  const cookie = cookieValue(first.cookie);
  store.config.adminPassword = 'a new password';
  assert.equal(await isSignedIn(store, withCookie(cookie), T0 + 1), false);
  store.config.adminPassword = 'correct horse';
  assert.equal(await isSignedIn(store, withCookie(cookie), T0 + 2), true);

  const { handleAdminApi } = await import('@/lib/admin-api/handler');
  const signOut = await handleAdminApi(
    new Request('https://nihaalnazeer.com/api/admin/session', { method: 'DELETE', headers: { origin: 'https://nihaalnazeer.com', cookie: `__Host-nn_admin=${cookie}` } }),
    store,
    { now: () => new Date(T0 + 3) },
  );
  assert.equal(signOut.status, 204);
  assert.equal(await isSignedIn(store, withCookie(cookie), T0 + 4), false);
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
  // next dev hands the route localhost as its host; the Host header holds the address the browser used, but only
  // this computer's own names count, and only under npm run dev.
  const notDev = await signInFrom('http://localhost:3000/api/admin/session', { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' });
  assert.equal(notDev.status, 403);
  store.config.devServer = true;
  const dev = await signInFrom('http://localhost:3000/api/admin/session', { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' });
  assert.equal(dev.status, 401);
  const devForeign = await signInFrom('http://localhost:3000/api/admin/session', { origin: 'http://elsewhere.example', host: '127.0.0.1:3000' });
  assert.equal(devForeign.status, 403);
  const rebound = await signInFrom('http://localhost:3000/api/admin/session', { origin: 'http://elsewhere.example:3000', host: 'elsewhere.example:3000' });
  assert.equal(rebound.status, 403);
});
