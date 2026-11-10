import { readContent } from '@/lib/content/read';

// Under `npm run dev` only: what `npm run build` writes to out/admin/data/published.json, from content/ as it is now.

export const dynamic = 'force-dynamic';

export function GET() {
  const { projects, home, redirects } = readContent();
  return Response.json({ projects, home, redirects }, { headers: { 'cache-control': 'no-store' } });
}
