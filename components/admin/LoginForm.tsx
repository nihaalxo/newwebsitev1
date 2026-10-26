'use client';

import { useActionState } from 'react';
import { signIn } from '@/app/admin/actions';
import type { SignInState } from './rules';

const INITIAL: SignInState = { error: null, email: '' };

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  const invalid = state.error ? true : undefined;
  const describedBy = state.error ? 'login-error' : undefined;

  return (
    <form className="adm-login-form" action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="adm-field">
        <label className="adm-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="adm-input"
          name="email"
          type="email"
          autoComplete="username"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      </div>
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
        {state.error && (
          <p className="adm-alert" id="login-error">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="adm-btn adm-btn-primary adm-btn-block"
        aria-disabled={pending || undefined}
        onClick={(event) => pending && event.preventDefault()}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
