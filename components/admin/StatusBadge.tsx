import type { Project } from '@/lib/cms/types';

/** Draft or Published, as a small labelled chip. `null` means the project hasn't been saved yet. */
export default function StatusBadge({ status }: { status: Project['status'] | null }) {
  const label = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'New';
  return (
    <span className="adm-badge" data-status={status ?? 'new'}>
      {label}
    </span>
  );
}
