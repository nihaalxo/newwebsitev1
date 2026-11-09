# nihaalnazeer.com

The portfolio of Nihaal Nazeer, designer. It is a dark, film-led site with these parts:

- The hero film.
- A few highlighted case studies, with the rest of the work listed under them.
- The Lair: the walk-through 3D portfolio at interactive.nihaalnazeer.com.
- About, CV and Contact.
- An All projects page with every case study.

Every case study and all of the site's text is edited in a password-protected admin at `/admin`. Nothing needs a
developer once it is live.

It is built with Next.js 15 (App Router), React 19 and plain CSS. The live site is a Cloudflare Worker, built with
OpenNext. Content lives in one of two places:

- **Local mode** (`npm run dev` on this computer): a JSON file, `.cms/content.json`, with uploaded files in
  `public/uploads/`.
- **Cloudflare** (the live site, and `npm run preview`): a D1 database for projects and settings, and an R2 bucket for
  uploads.

**[GO-LIVE.md](GO-LIVE.md) has the steps to put it on Cloudflare and `nihaalnazeer.com`.**

## Run it on this computer

It needs [Node.js](https://nodejs.org/) 20.12 or newer.

1. In a terminal, in this folder:
   ```sh
   npm install
   cp .env.example .env.development.local
   ```
2. Create `.dev.vars` in this folder with the admin login:
   ```sh
   ADMIN_EMAIL=me@example.com
   ADMIN_PASSWORD=any-password-for-this-computer
   LOCAL_SESSION_SECRET=a-long-random-string
   ```
   - Make the session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
   - Keep the login in `.dev.vars`, not in a `.env` file. OpenNext copies every `.env` file into the Worker it
     builds, and the build stops if one holds these names.
3. Start it:
   ```sh
   npm run dev
   ```
4. Open http://localhost:3000 for the site, and http://localhost:3000/admin to edit it.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run typecheck`, `npm run lint` | Check the code |
| `npm run build` | The plain Next.js production build |
| `npm run cf:build`, then `npm run preview` | The Cloudflare build, run locally with a local database and bucket (GO-LIVE.md shows the full list) |

## Add a project

1. Go to `/admin`, sign in and choose **New project**.
2. Fill in the basics:
   - A title.
   - A web address: the last part of the URL, e.g. `my-chaii-london`. Use lowercase letters, numbers and hyphens.
   - A category, year and discipline.
   - A one-sentence summary.
3. Add a cover image and pick the colour the case study is lit with.
4. Build the page from text, image, gallery, video and quote blocks. Images are converted to WebP in the browser
   before they upload.
5. Save it as a draft, and use **Preview** to see it exactly as visitors will. Drafts never appear on the public site.
6. Publish it. **Highlight** gives it a large plate on the home page, for up to three projects at a time. Other
   projects are listed under the highlights. Change the order in the project list.

**View all projects** on the home page opens the All projects page, where every published project gets a plate.

## How local mode works

- Everything edited under `npm run dev` is written to `.cms/content.json`, and uploads go to `public/uploads/`.
  - Both are committed to git: they are the content that `npm run cms:to-cloudflare` copies to the live site.
  - Editing only works under `npm run dev`.
- The starting content comes from two places:
  - `scripts/catalogue.json`: all 21 projects, their summaries and image descriptions.
  - The project images in `public/`.
- `npm run cms:seed` builds `.cms/content.json` and the WebP images in `public/uploads/seed/` from them.
  - It refuses to run if `.cms/content.json` exists, because that would throw away edits.
  - `npm run cms:seed -- --force` rebuilds it anyway.

Supabase is still supported as an alternative store. It is used only when both `NEXT_PUBLIC_SUPABASE_*` variables are
set, and `npm run cms:push` copies content there. The live site doesn't use it.

## Where things are

| Path | What it is |
| --- | --- |
| `app/(site)/`, `components/site/` | The public site |
| `app/admin/`, `components/admin/` | The admin |
| `lib/cms/` | The content model (`types.ts`) and the stores: `local.ts`, `cloudflare.ts` (D1 and R2) and `supabase.ts` |
| `cloudflare/worker.mjs`, `wrangler.jsonc` | The Worker's entry point and configuration |
| `d1/migrations/` | The Cloudflare database tables |
| `app/cms/`, `app/api/cms/upload/` | Serving and receiving uploads on Cloudflare |
| `app/api/cms/local-upload/` | Receiving uploads in local mode |
| `scripts/` | `catalogue.json`, `seed-local.mjs`, `push-to-cloudflare.mjs`, `check-deploy-env.mjs`, `film-sizes.mjs`, `dev.mjs` |
| `.cms/content.json`, `public/uploads/` | Local-mode content and uploads |
