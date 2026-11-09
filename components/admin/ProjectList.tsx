'use client';

import { useEffect, useRef, useState } from 'react';
import { reorderProjects, setFeatured } from '@/app/admin/actions';
import { MAX_HIGHLIGHTS, type Project } from '@/lib/cms/types';
import { callServer } from './call-server';
import { SwitchField } from './fields';
import { ChevronDown, ChevronUp } from './icons';
import { editPath } from './paths';
import StatusBadge from './StatusBadge';

/** The few fields the list needs, so the page doesn't ship every project's story to the browser. */
export interface ProjectRow {
  id: string;
  title: string;
  discipline: string;
  year: number;
  status: Project['status'];
  featured: boolean;
  thumb: string | null;
}

const nameOf = (row: ProjectRow) => row.title.trim() || 'Untitled project';

export default function ProjectList({ initialRows }: { initialRows: ProjectRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  // Order changes are sent one after another, so quick clicks can't land on the server out of order.
  const orderQueue = useRef<Promise<void>>(Promise.resolve());
  const highlighted = rows.filter((row) => row.featured).length;

  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, rows]);

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    const row = rows[index];
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setProblem(null);

    // Keep focus on the arrow that was pressed, or its partner once the row reaches the top or bottom.
    const atEdge = target === 0 || target === rows.length - 1;
    const pressed = offset < 0 ? 'up' : 'down';
    const partner = offset < 0 ? 'down' : 'up';
    setPendingFocus(`row-${row.id}-${atEdge ? partner : pressed}`);
    setAnnouncement(`${nameOf(row)} moved to position ${target + 1} of ${rows.length}.`);

    const ids = next.map((r) => r.id);
    orderQueue.current = orderQueue.current.then(async () => {
      const result = await callServer(() => reorderProjects(ids), (error) => ({ ok: false as const, error }));
      if (!result.ok) {
        setProblem(`Couldn't save the new order. ${result.error}`);
        setAnnouncement(`Couldn't save the new order. ${result.error}`);
      }
    });
  }

  async function toggleFeatured(row: ProjectRow, featured: boolean) {
    const setSwitch = (on: boolean) => setRows((current) => current.map((r) => (r.id === row.id ? { ...r, featured: on } : r)));
    // At the limit the server is expected to refuse, so the switch waits for its answer instead of flashing "4 of 3".
    if (!featured || highlighted < MAX_HIGHLIGHTS) setSwitch(featured);
    setProblem(null);
    const result = await callServer(() => setFeatured(row.id, featured), (error) => ({ ok: false as const, error }));
    if (!result.ok) {
      setSwitch(!featured);
      setProblem(result.error);
      setAnnouncement(result.error);
      return;
    }
    setSwitch(featured);
    const where = featured ? 'large on the home page' : 'in the list under the highlights';
    setAnnouncement(
      row.status === 'published' ? `${nameOf(row)} now appears ${where}.` : `${nameOf(row)} will appear ${where} once published.`,
    );
  }

  return (
    <>
      <p className="adm-list-count">
        {highlighted} of {MAX_HIGHLIGHTS} highlighted
        {highlighted > MAX_HIGHLIGHTS && `. Turn ${highlighted - MAX_HIGHLIGHTS} off to get back to the limit.`}
      </p>
      {problem && (
        <div className="adm-alert adm-list-alert">
          <p>{problem}</p>
          <button type="button" className="adm-btn adm-btn-small" onClick={() => window.location.reload()}>
            Reload the list
          </button>
        </div>
      )}
      <ol className="adm-rows">
        {rows.map((row, index) => {
          const name = nameOf(row);
          return (
            <li key={row.id} className="adm-row">
              <div className="adm-thumb">
                {row.thumb ? <img src={row.thumb} alt="" loading="lazy" decoding="async" /> : <span>No cover</span>}
              </div>
              <div className="adm-row-main">
                <h2 className="adm-row-title">{name}</h2>
                <p className="adm-row-meta">
                  <StatusBadge status={row.status} />
                  <span>{[row.discipline, Number.isFinite(row.year) ? row.year : ''].filter(Boolean).join(', ')}</span>
                </p>
              </div>
              <div className="adm-row-feature">
                <SwitchField
                  id={`featured-${row.id}`}
                  label={
                    <>
                      Highlight<span className="adm-vh">: {name}</span>
                    </>
                  }
                  checked={row.featured}
                  onChange={(featured) => toggleFeatured(row, featured)}
                />
              </div>
              <div className="adm-row-move" role="group" aria-label={`Position of ${name}`}>
                <button
                  id={`row-${row.id}-up`}
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                >
                  <ChevronUp />
                  <span className="adm-vh">Move {name} up</span>
                </button>
                <button
                  id={`row-${row.id}-down`}
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  <ChevronDown />
                  <span className="adm-vh">Move {name} down</span>
                </button>
              </div>
              {/* A plain link, like AdminNav: the editor loads as its own page, so Back can't drop unsaved edits unasked. */}
              <a className="adm-btn adm-btn-small adm-row-edit" href={editPath(row.id)}>
                Edit<span className="adm-vh"> {name}</span>
              </a>
            </li>
          );
        })}
      </ol>
      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </>
  );
}
