import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Local-mode admin session: a small signed token kept in an httpOnly cookie. Supabase mode uses Supabase Auth instead.

export const SESSION_COOKIE = 'nn_admin';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

interface SessionPayload {
  email: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

function hmac(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** "<base64url payload>.<base64url HMAC-SHA256 of the payload>" */
export function signSession(email: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = { email, exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${hmac(encoded, secret).toString('base64url')}`;
}

/** The signed-in email, or null when the token is malformed, tampered with or expired. */
export function verifySession(token: string, secret: string, now = Date.now()): { email: string } | null {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra !== undefined) return null;

  const expected = hmac(encoded, secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= now) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

/** Compares two secrets in constant time, whatever their lengths. */
export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
