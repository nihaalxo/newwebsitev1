import type { Category } from '@/lib/cms/types';

/*
 * The discipline All projects is filtered to. The case file reads it when it opens, so Previous and Next step through
 * the projects that are showing. Module state, because the filters and the case file are separate client components.
 */

export type Filter = Category | 'all';

let active: Filter = 'all';

export function getActiveFilter(): Filter {
  return active;
}

export function setActiveFilter(filter: Filter): void {
  active = filter;
}
