'use client';

import { useSearchParams } from 'next/navigation';
import { XMark } from './icons';
import LoginForm from './LoginForm';
import { safeAdminPath } from './paths';

export default function LoginScreen() {
  const next = safeAdminPath(useSearchParams().get('next'));
  return (
    <div className="adm adm-login">
      <main className="adm-login-panel">
        <p className="adm-brand">
          <XMark />
          <span className="adm-brand-name">Nihaal Nazeer</span>
          <span className="adm-brand-sub">Site admin</span>
        </p>
        <div>
          <h1 className="adm-h1">Sign in</h1>
          <p className="adm-lede">To edit your projects.</p>
        </div>
        <LoginForm next={next} />
      </main>
    </div>
  );
}
