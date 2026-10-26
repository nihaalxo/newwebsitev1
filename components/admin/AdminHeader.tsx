import AdminNav from './AdminNav';
import { XMark } from './icons';

const MODE_TEXT = {
  local: 'Local mode: saving to .cms/content.json',
  supabase: 'Saving to Supabase',
} as const;

export default function AdminHeader({ email, mode }: { email: string; mode: 'local' | 'supabase' }) {
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
          <p className="adm-mode" data-mode={mode}>
            {MODE_TEXT[mode]}
          </p>
          {/* A native POST, not a server action: a full page load, so unsaved changes get the browser's prompt. */}
          <form method="post" action="/admin/signout">
            <button type="submit" className="adm-btn adm-btn-small">
              Sign out<span className="adm-vh"> of {email}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
