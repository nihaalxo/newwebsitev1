'use client';

import { useState } from 'react';
import { api } from '@/lib/admin-api/client';
import AdminNav from './AdminNav';
import { XMark } from './icons';

export default function AdminHeader() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    await api.signOut();
    // A full page load, so an editor with unsaved changes gets the browser's prompt first.
    window.location.assign('/admin/login');
    setBusy(false);
  }

  return (
    <header className="adm-top">
      <div className="adm-top-in">
        <a className="adm-brand" href="/admin">
          <XMark />
          <span className="adm-brand-name">Nihaal Nazeer</span>
          <span className="adm-brand-sub">Site admin</span>
        </a>
        <AdminNav />
        <div className="adm-top-end">
          {/* Ends the session on every device, so a copied cookie stops working too. */}
          <button type="button" className="adm-btn adm-btn-small" onClick={signOut} aria-disabled={busy || undefined}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
