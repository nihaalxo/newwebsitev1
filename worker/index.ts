import { handleAdminApi } from '../lib/admin-api/handler';
import { cloudflareStore } from './cloudflare-store';
import { FILM, filmSize, serveFilm } from './films';

/*
 * The Worker (wrangler.jsonc "main"). Cloudflare answers every page, image, font and script from out/ without
 * running it; it runs only for the paths in assets.run_worker_first:
 * - a film in public/: answered with byte ranges (worker/films.ts);
 * - /api/admin/*: the admin's API (lib/admin-api/handler.ts), with drafts and uploads in R2;
 * - any other /api/ address: a JSON 404.
 * Anything else that reaches it goes to the static assets, which give the 404 page for an unknown address.
 * No Next, React or 'server-only' here: just the shared admin code and the R2 bindings.
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const read = request.method === 'GET' || request.method === 'HEAD';

    // The API first: an upload's address can end in .mp4 too (/api/admin/media/p/<id>/film-….mp4).
    if (pathname.startsWith('/api/admin/') || pathname === '/api/admin') return handleAdminApi(request, cloudflareStore(env));
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found.' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      });
    }
    if (read && FILM.test(pathname)) {
      const size = filmSize(pathname);
      if (size > 0) {
        const film = await serveFilm(request, env, size);
        if (film) return film;
      }
      return env.ASSETS.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
