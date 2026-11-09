import { cloudflareEnv } from '@/lib/cms/cloudflare-env';
import { serveUpload } from '@/lib/cms/r2-files';

// The admin's uploads in R2, at /cms/<path>, with ranges answered (lib/cms/r2-files.ts). On Cloudflare the Worker's
// entry point (cloudflare/worker.mjs) answers these before the site runs; this route covers a build without it.

export const dynamic = 'force-dynamic';

function serve(request: Request) {
  const env = cloudflareEnv();
  if (!env) return new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return serveUpload(env.CMS_UPLOADS, new URL(request.url).pathname.slice('/cms/'.length), request);
}

export function GET(request: Request) {
  return serve(request);
}

export function HEAD(request: Request) {
  return serve(request);
}
