// Where things live, in one place. The public case-study route is app/(site)/work/[slug].

export const caseStudyPath = (slug: string) => `/work/${slug}`;
export const previewPath = (id: string) => `/admin/preview/${id}`;
export const editPath = (id: string) => `/admin/projects/${id}`;
