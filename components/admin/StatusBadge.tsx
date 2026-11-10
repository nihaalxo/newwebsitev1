/** Where a project stands, as a small labelled chip. */
export type ProjectStatus = 'live' | 'changed' | 'draft' | 'hidden' | 'publishing' | 'failed' | 'new';

const LABELS: Record<ProjectStatus, string> = {
  live: 'Live',
  changed: 'Live, changes not published',
  draft: 'Draft, not on the site',
  hidden: 'Hidden',
  publishing: 'Publishing',
  failed: 'Publish failed',
  new: 'New',
};

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="adm-badge" data-status={status === 'live' ? 'published' : status}>
      {LABELS[status]}
    </span>
  );
}

/** A project's status from what is live and its draft, if it has one. */
export function statusOf(live: boolean, draft: { state: 'editing' | 'publishing' | 'failed' | 'hidden'; action: string } | null | undefined): ProjectStatus {
  if (!draft) return live ? 'live' : 'new';
  if (draft.state === 'publishing') return 'publishing';
  if (draft.state === 'failed') return 'failed';
  if (draft.state === 'hidden') return 'hidden';
  return live ? 'changed' : 'draft';
}
