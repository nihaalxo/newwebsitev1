# nihaalnazeer.com

The portfolio of Nihaal Nazeer, designer: the hero film, a few highlighted case studies with the rest of the work
under them, the Lair (the walk-through 3D portfolio at interactive.nihaalnazeer.com), About, CV and Contact, and an All
projects page.

It is a static site: Next.js 15 (App Router) exports every page to `out/` at build time, and Cloudflare serves those
files. The projects live in this repository as JSON files. A small admin at `/admin` edits the projects and the home
page's highlights; everything else (the words, the look) is edited here, in code.

**[GO-LIVE.md](GO-LIVE.md) has the steps to put it on Cloudflare, what could ever cost money, and how to change the
password or the GitHub token.**

## What runs where

| Part | Where it runs |
| --- | --- |
| Pages, CSS, scripts, fonts, images | Static files in `out/`, served by Cloudflare (Workers static assets). No code runs for them |
| The films in `public/` (`*.mp4` and friends) | The Worker (`worker/index.ts`), which answers byte ranges so Safari can play them |
| The admin's pages (`/admin`, `/admin/edit`, `/admin/preview`, `/admin/login`) | Static files, like the site |
| The admin's API (`/api/admin/*`) | The Worker: sign-in, drafts, uploads, publishing |
| Drafts, build reports, the session key | R2 bucket `nihaalnazeer-admin` (private) |
| Images and films uploaded in the admin | R2 bucket `nihaalnazeer-media`, served at `https://media.nihaalnazeer.com` without the Worker |
| Publishing | One commit to `nihaalxo/newwebsitev1` on `main`, made by the Worker through GitHub's API with `GITHUB_TOKEN`. It only ever writes `content/` |
| Building and deploying | Workers Builds: each push to `main` runs `npm run ci` (`scripts/ci.mjs`), which builds `out/`, deploys it, and leaves a build report the admin reads to say "Building", "Live" or "Failed" |

So a publish from the admin and a commit pushed from this computer go live the same way: a commit on `main`, then a
build of 2 to 4 minutes.

## Run it on this computer

It needs Node.js 24 (`.node-version`; 20.12 or newer works).

1. In this folder:
   ```sh
   npm install
   ```
2. Create `.dev.vars` with a password for the admin on this computer (it is gitignored, never committed):
   ```sh
   echo "ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")" > .dev.vars
   ```
3. Use these:

| Command | What it does |
| --- | --- |
| `npm run dev` | The site at http://localhost:3000, read from `content/` on every reload, and the admin at http://localhost:3000/admin. Here the admin publishes straight into `content/` and `public/uploads/p/` instead of GitHub, and refuses files over 25 MiB ("Big films go through the live admin.") |
| `npm run check` | Type checks (site and Worker), lint, the content check (every file valid and in canonical form), and the unit tests |
| `npm run build` | The static site in `out/`, then `scripts/postbuild.mjs`: film sizes, the admin's index of `content/`, `_redirects`, and checks on file sizes and stray `localhost` links |
| `npm run preview` | `npm run build`, then the real Worker with `wrangler dev` on port 4821 (`PORT=…` to change it), with a local R2 on this computer |
| `npm run content:format` | Rewrites `content/` in canonical form, if `npm run check` asks for it |

Publishing under `npm run preview` needs a GitHub. To try it without one, start the stand-in, and point the Worker at
it in `.dev.vars`:

```sh
node tests/fake-github.mjs 4830          # in its own terminal
# .dev.vars gets two more lines:
#   GITHUB_TOKEN=test
#   GITHUB_API=http://127.0.0.1:4830
PORT=4821 npm run preview                # in another
node tests/preview-admin.mjs http://127.0.0.1:4821 http://127.0.0.1:4830   # the end-to-end check
```

`tests/preview-admin.mjs` changes `content/` while it runs and puts it back with `git checkout`, so it refuses to start
while `content/` has uncommitted changes.

## How Claude edits the site

1. `git pull --ff-only` first. The admin commits to `main`, so this computer may be behind.
2. Edit:
   - a project: `content/projects/<slug>.json` (the shape is `Project` in `lib/cms/types.ts`);
   - the home page's order and highlights (up to 3): `content/home.json`;
   - every other word on the site: `components/site/copy.ts`;
   - images and films up to 25 MiB: `public/uploads/p/<project id>/`, referred to as `/uploads/p/<project id>/<file>`.
     Bigger films go up through the live admin, which keeps them in R2.
   - An old address that should keep working: `content/redirects.json` (the admin adds these itself on a rename).
3. Check with `npm run dev` (look at it) and `npm run check`.
4. Commit. Push only with Nihaal's OK.
5. It is live once https://nihaalnazeer.com/admin/data/index.json shows the commit.

## Add a project in the admin

1. Go to `/admin`, sign in, and choose **New project**.
2. Fill in the title, the web address (lowercase letters, numbers and hyphens, e.g. `my-chaii-london`), the category,
   year, discipline and one-sentence summary.
3. Add a cover image. The accent colour is taken from it; change it if you like.
4. Build the page from text, image, gallery, video and quote blocks. Images become WebP in the browser before they
   upload. Films upload in parts, with a poster taken from the film.
5. It saves by itself every few seconds. **Preview** shows the case file, the home page and All projects as they will
   look.
6. **Publish**. After 2 to 4 minutes the admin says **Live**. If a build fails, it shows why, with **Try again** and
   **Undo this publish**.
7. In the project list, **Highlight** gives a project a large plate on the home page (up to three), and the arrows set
   the order. Changes to the list are published with **Publish all changes**.

## Where things are

| Path | What it is |
| --- | --- |
| `content/` | The projects, `home.json` and `redirects.json`: the site's content |
| `public/uploads/` | Images and films that ship with the site |
| `app/(site)/`, `components/site/` | The public site; `components/site/copy.ts` holds its words |
| `app/admin/`, `components/admin/` | The admin's pages |
| `lib/content/` | Reading, checking and writing `content/` |
| `lib/admin-api/` | The admin's API: `handler.ts` (routes), `plan.ts` (what a publish changes), `github.ts`, `auth.ts`, and `file-store.ts` (the `npm run dev` version) |
| `worker/` | The Worker: films, the API on R2 (`cloudflare-store.ts`) |
| `wrangler.jsonc`, `public/_headers`, `scripts/postbuild.mjs` | The Cloudflare configuration |
| `scripts/ci.mjs` | The Workers Builds deploy command |
| `tests/` | Unit tests (`npm run check`), the GitHub stand-in, the end-to-end check, and a CPU timing (`node --import tsx tests/cpu-proxy.ts`) |
