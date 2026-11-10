'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, loadPublished, type AdminState } from '@/lib/admin-api/client';
import type { Published } from '@/lib/content/assemble';
import AdminHeader from './AdminHeader';
import PublishBar from './PublishBar';

/*
 * Every admin page except sign-in and the preview. The pages are static files: this loads what they show from the
 * API (the drafts and the publish in progress) and from the live build (admin/data/published.json), and shares it.
 * A signed-out visitor is sent to the sign-in page by the first API call.
 */

export interface AdminData {
  state: AdminState;
  published: Published;
  /** Asks the server again, after a change here or to follow a build. */
  refresh: () => Promise<void>;
}

const AdminContext = createContext<AdminData | null>(null);

export function useAdmin(): AdminData {
  const data = useContext(AdminContext);
  if (!data) throw new Error('useAdmin outside AdminShell');
  return data;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState | null>(null);
  const [published, setPublished] = useState<Published | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const builtAt = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await api.state();
    if (!next.ok) {
      if (next.status !== 401) setProblem(next.error);
      return;
    }
    const { ok: _ok, ...fresh } = next;
    // A new build went live: its content is the new starting point.
    if (builtAt.current !== fresh.deployed.builtAt) {
      const content = await loadPublished();
      if (!content.ok) {
        setProblem(content.error);
        return;
      }
      builtAt.current = fresh.deployed.builtAt;
      setPublished(content.published);
    }
    setProblem(null);
    setState(fresh);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ready = state && published;
  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-main">
        Skip to content
      </a>
      <AdminHeader />
      {ready ? (
        <AdminContext.Provider value={{ state, published, refresh }}>
          <PublishBar />
          <main className="adm-main" id="adm-main" tabIndex={-1}>
            {children}
          </main>
        </AdminContext.Provider>
      ) : (
        <main className="adm-main" id="adm-main" tabIndex={-1}>
          {problem ? (
            <div className="adm-alert adm-list-alert" role="alert">
              <p>{problem}</p>
              <button type="button" className="adm-btn adm-btn-small" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          ) : (
            <p className="adm-lede" role="status">
              Loading…
            </p>
          )}
        </main>
      )}
    </div>
  );
}
