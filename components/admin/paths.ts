// Where things live, in one place. The public case-study route is app/(site)/work/[slug]. The admin pages are static
// files, so a project is chosen by the query string.

export type PreviewView = 'case' | 'home' | 'work';

export const caseStudyPath = (slug: string) => `/work/${slug}`;
export const editPath = (id: string) => `/admin/edit?id=${encodeURIComponent(id)}`;
export const newProjectPath = '/admin/edit?new';
export const previewPath = (id: string, view: PreviewView = 'case') => `/admin/preview?id=${encodeURIComponent(id)}&view=${view}`;

/** Only an admin page may be returned to after signing in. */
export function safeAdminPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/admin') || next.startsWith('//') || next.startsWith('/admin/login')) return '/admin';
  return next;
}
