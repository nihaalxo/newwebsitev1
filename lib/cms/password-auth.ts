import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, safeEqual, signSession, verifySession } from './session';
import type { AuthResult } from './types';

/*
 * One admin, signed in with an email and password held in the environment (ADMIN_EMAIL, ADMIN_PASSWORD) and kept
 * signed in by an HMAC-signed cookie (LOCAL_SESSION_SECRET). Local mode reads them from .env.local; on Cloudflare
 * they are Worker secrets, or .dev.vars in the local preview.
 */

type EnvSource = Record<string, string | undefined>;

interface Credentials {
  email: string;
  password: string;
  secret: string;
}

export interface PasswordAuthOptions {
  /** Where the three variables come from. Called on every check, so a changed secret applies at once. */
  env: () => EnvSource;
  /** Whether the session cookie is sent over HTTPS only. */
  secure: boolean;
  /** Finishes "…isn't set up: add X, Y to " with where the variables belong in this mode. */
  setupHint: string;
}

export interface PasswordAuth {
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  currentAdmin(): Promise<{ email: string } | null>;
  /** Throws Error('UNAUTHORIZED') unless a valid session cookie is present. */
  requireAdmin(): Promise<void>;
}

function readCredentials(source: EnvSource): { ok: true; value: Credentials } | { ok: false; missing: string[] } {
  const env = {
    ADMIN_EMAIL: source.ADMIN_EMAIL?.trim() ?? '',
    ADMIN_PASSWORD: source.ADMIN_PASSWORD ?? '',
    LOCAL_SESSION_SECRET: source.LOCAL_SESSION_SECRET ?? '',
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    value: { email: env.ADMIN_EMAIL.toLowerCase(), password: env.ADMIN_PASSWORD, secret: env.LOCAL_SESSION_SECRET },
  };
}

export function passwordAuth({ env, secure, setupHint }: PasswordAuthOptions): PasswordAuth {
  async function sessionEmail(): Promise<string | null> {
    const credentials = readCredentials(env());
    if (!credentials.ok) return null;
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = verifySession(token, credentials.value.secret);
    if (!session || !safeEqual(session.email, credentials.value.email)) return null;
    return session.email;
  }

  return {
    async signIn(email, password) {
      const credentials = readCredentials(env());
      if (!credentials.ok) {
        return { ok: false, error: `Sign-in isn't set up: add ${credentials.missing.join(', ')} to ${setupHint}.` };
      }
      // Both comparisons always run, so a wrong email takes as long as a wrong password.
      const emailMatches = safeEqual(email.trim().toLowerCase(), credentials.value.email);
      const passwordMatches = safeEqual(password, credentials.value.password);
      if (!(emailMatches && passwordMatches)) return { ok: false, error: "That email and password don't match." };

      (await cookies()).set(SESSION_COOKIE, signSession(credentials.value.email, credentials.value.secret), {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
      return { ok: true };
    },

    async signOut() {
      (await cookies()).delete(SESSION_COOKIE);
    },

    async currentAdmin() {
      const email = await sessionEmail();
      return email ? { email } : null;
    },

    async requireAdmin() {
      if (!(await sessionEmail())) throw new Error('UNAUTHORIZED');
    },
  };
}
