'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/admin-api/client';

function waitText(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? 'about a minute' : `${minutes} minutes`;
}

export default function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    if (!password) {
      setError('Enter the password.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await api.signIn(password);
    if (result.ok) {
      window.location.assign(next);
      return;
    }
    setPending(false);
    if (result.status === 429) setError(`Too many tries. Wait ${waitText(result.retryAfter ?? 60)}, then try again.`);
    else setError(result.error);
  }

  const invalid = error ? true : undefined;
  const describedBy = error ? 'login-error' : undefined;

  return (
    <form className="adm-login-form" onSubmit={submit} noValidate>
      {/* For password managers, which file a password under a username. */}
      <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
      <div className="adm-field">
        <label className="adm-label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="adm-input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      </div>
      {/* Always present, so a new message is announced the moment it appears. */}
      <div role="alert">
        {error && (
          <p className="adm-alert" id="login-error">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="adm-btn adm-btn-primary adm-btn-block"
        aria-disabled={pending || undefined}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
