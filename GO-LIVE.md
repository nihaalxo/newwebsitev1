# Going live on Cloudflare

The site runs as one Cloudflare Worker on the Cloudflare account that already holds `nihaalnazeer.com`. OpenNext
(`@opennextjs/cloudflare`) builds the Next.js app into that Worker. The projects and site settings live in a D1
database, and files uploaded in the admin live in an R2 bucket. There is no Vercel and no Supabase.

Do the steps once, in order, in a terminal in this folder. They take about half an hour.

Everything below was built and tested against the local Cloudflare preview (`npm run preview`). That covered signing
in, editing, uploading an image, seeing it on the page, and films answering byte ranges. None of the commands that
reach Cloudflare (`wrangler login`, `d1 create`, `r2 bucket create`, `--remote`, `secret put`, `deploy`) has been run
yet.

| Name | What it is |
| --- | --- |
| `nihaalnazeer` | The Worker (`name` in `wrangler.jsonc`) |
| `nihaalnazeer-cms` | The D1 database, bound as `CMS_DB` |
| `nihaalnazeer-uploads` | The R2 bucket, bound as `CMS_UPLOADS`. Uploads are kept under `cms/` and served at `/cms/...` |

## 1. Install, and sign in to Cloudflare

1. Check `node -v` prints 20.12 or newer, then run:
   ```sh
   npm install
   npx wrangler login
   ```
2. A browser window opens. Sign in with the personal Cloudflare account that holds `nihaalnazeer.com`, and press
   **Allow**.
3. Run `npx wrangler whoami` to confirm the account. If it lists more than one account, copy the right **Account ID**
   into `wrangler.jsonc` as `"account_id": "…"`, next to `"name"`.

## 2. Create the database

1. Run:
   ```sh
   npx wrangler d1 create nihaalnazeer-cms --location weur
   ```
   `weur` is Western Europe. If wrangler offers to add the database to the configuration, answer **No**: it is
   already in `wrangler.jsonc`.
2. Copy the `database_id` it prints into `wrangler.jsonc`, in place of `00000000-0000-0000-0000-000000000000`. The id
   is not a secret, so commit the change.

## 3. Create the bucket

1. Run:
   ```sh
   npx wrangler r2 bucket create nihaalnazeer-uploads
   ```
2. If it says R2 isn't enabled, open **R2 Object Storage** in the Cloudflare dashboard and enable it, then run the
   command again. Cloudflare can ask for a payment method even when usage stays inside the free allowance. Check the
   R2 pricing page for the current allowance.

## 4. Create the tables

```sh
npm run db:migrate:remote
```

Answer yes. This applies `d1/migrations/0001_init.sql`, which creates the `projects` and `settings` tables.

## 5. Set the admin login as Worker secrets

The login for `/admin` is three Worker secrets. Cloudflare stores them encrypted, and they never appear in the code.

1. Make a session secret, and copy what it prints:
   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
2. Set the three secrets. Each command asks for its value:
   ```sh
   npx wrangler secret put ADMIN_EMAIL
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put LOCAL_SESSION_SECRET
   ```
   - For `ADMIN_PASSWORD`, use a long password that isn't used anywhere else. It doesn't need to match the local one.
   - For `LOCAL_SESSION_SECRET`, paste the value from item 1.
   - The first command asks whether to create the Worker `nihaalnazeer`. Answer yes. It stays empty until step 9.

To change the password later, run `npx wrangler secret put ADMIN_PASSWORD` again. Changing `LOCAL_SESSION_SECRET`
signs every session out.

## 6. Move the local login out of `.env.local`

OpenNext copies every `.env` file into the Worker it uploads, including `.env.local` and `.env.development.local`. The
admin login must not travel with it.

1. Create a file named `.dev.vars` in this folder.
2. Move the `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `LOCAL_SESSION_SECRET` lines out of `.env.local` and into
   `.dev.vars`, in the same `NAME=value` form.

`npm run dev` and `npm run preview` both read `.dev.vars`. It is never committed or uploaded. `npm run cf:build` and
`npm run deploy` stop, naming the file, if any `.env` file still sets one of those three names.

## 7. Check the public addresses

The build bakes two public addresses into the pages:

| Variable | Default | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://nihaalnazeer.com` | Canonical links, the sitemap and share images |
| `NEXT_PUBLIC_LAIR_URL` | `https://interactive.nihaalnazeer.com/?film=on` | Every Lair link (they open in a new tab) |

The defaults are the live addresses, so nothing needs setting. Two things to check:

- `.env.local` sets `NEXT_PUBLIC_SITE_URL`, and a production build reads `.env.local`. That line must be
  `https://nihaalnazeer.com`, or deleted. The build stops if it points at `localhost`.
- Addresses for this computer only, like the Lair running locally, go in `.env.development.local`. Only `npm run dev`
  uses that file.

## 8. Copy the content up

1. See what will happen:
   ```sh
   npm run cms:to-cloudflare -- --remote --dry-run
   ```
2. Then run it:
   ```sh
   npm run cms:to-cloudflare -- --remote
   ```

This copies `.cms/content.json` (the 21 projects and every site setting) into D1. Any files uploaded in the local
admin go into R2, and their addresses change from `/uploads/...` to `/cms/...`. The seed images and the films in
`public/` ship with the site itself, so they aren't copied.

The command is safe to run again: it matches projects by their web address. But it replaces the site settings whole.
After the site has been edited in the live admin, running it again would put the local settings back over the live
ones.

## 9. Deploy

```sh
npm run deploy
```

This checks the `.env` files, builds the site with OpenNext, lists the films' sizes and uploads the Worker. It ends
with an address like `https://nihaalnazeer.<account-subdomain>.workers.dev`. Open it and check the home page, `/work`
and the sign-in at `/admin`.

The Worker is about 1.5 MB compressed, inside the free plan's 3 MB limit. The free plan also caps CPU time per
request. If pages fail with error 1102 ("Worker exceeded resource limits"), the Workers Paid plan raises the limits.

## 10. Put it on nihaalnazeer.com

1. If the domain is still on the old Cloudflare Pages project, remove it there first: **Workers & Pages >** the old
   project **> Custom domains**. Remove `nihaalnazeer.com` and `www.nihaalnazeer.com`.
2. Open **DNS > Records** for `nihaalnazeer.com`. Delete the `A`, `AAAA` or `CNAME` records for `nihaalnazeer.com`
   and for `www`, because a custom domain can't be added while a record exists for that name. Leave the `interactive`
   record (the Lair), the `assets` record (the Lair's files) and any `MX` or `TXT` records (email) alone.
3. Open **Workers & Pages > nihaalnazeer > Settings > Domains & Routes > Add > Custom domain**. Add
   `nihaalnazeer.com`, then add `www.nihaalnazeer.com` the same way.
4. Cloudflare creates the DNS records and the certificate itself, usually within a few minutes.
5. Once both work, the `workers.dev` address can be turned off in the same panel.

## 11. Check the live site

- **The intro:** `https://nihaalnazeer.com` plays the intro on a first visit, and a reload skips it.
  `https://nihaalnazeer.com/?from=lair` skips it too, and the address loses `?from=lair`.
- **The Lair links:** every Lair link opens `https://interactive.nihaalnazeer.com/?film=on` in a new tab.
- **The work:** `/work` opens with its filters working. A project opens in its case file, and
  `/work/my-chaii-london` opens on that project.
- **The films:** check the films play and seek on an iPhone. Safari needs films answered in byte ranges, and this
  command should print `HTTP/2 206` and `content-range: bytes 0-1/2818651`:
  ```sh
  curl -sI -H "Range: bytes=0-1" https://nihaalnazeer.com/films/lair-ship.mp4
  ```
- **The admin:** sign in at `/admin` with the email and password from step 5.
  1. Change a heading in **Site settings**, save, and check it on the home page. Then change it back.
  2. Upload an image, for example the portrait. Save, and check it appears on the page at an address starting with
     `/cms/`.

From then on, edit the site at `nihaalnazeer.com/admin`. Saved changes appear on the public pages straight away.

## Afterwards

- **The Lair's links back to the site.** The game's exit should come back to `https://nihaalnazeer.com/?from=lair`.
  That way the intro doesn't play again straight after the Lair's own film. The live game must not end at
  `site.local`. About is now a section of the home page, so `/about` shows the 404 page: the game's link to About
  should be `https://nihaalnazeer.com/#about`.
- **The CV.** The PDF in **Site settings > CV** still says "AI Product Designer" and doesn't mention Codex. Upload
  the current CV there.
- **The hero film.** `finalheroshot.compressed.mp4` is about 20 MB and is most of what a first visit downloads.
  1. Re-export it as an H.264 MP4 of 1–1.5 MB, 1280–1920 px wide.
  2. Upload it in **Site settings**.
  3. Set **Loop from** and **Loop to** again. Replacing the film sets both to 0, which plays the whole film.

## How the pieces fit

| Path | What it is |
| --- | --- |
| `wrangler.jsonc` | The Worker: bindings, static assets, and which requests reach the Worker first |
| `cloudflare/worker.mjs` | The entry point. It serves films from `public/` and uploads from `/cms/` with byte ranges, and passes everything else to the site |
| `lib/cms/cloudflare.ts`, `lib/cms/r2-files.ts` | The Cloudflare content store (D1 and R2) and the `/cms/` file serving |
| `d1/migrations/` | The database tables (`npm run db:migrate:local` or `:remote`) |
| `scripts/push-to-cloudflare.mjs` | `npm run cms:to-cloudflare`: local content into D1 and R2 (`--local` by default, `--remote`, `--dry-run`) |
| `scripts/check-deploy-env.mjs` | Runs before every build: no secrets in `.env` files, and no `localhost` in the public addresses |
| `scripts/film-sizes.mjs` | Runs after the OpenNext build: lists film sizes for byte-range serving |
| `.dev.vars` | The local admin login, read by `npm run dev` and `npm run preview`. Never committed |

To try the Cloudflare version on this computer, with its own local database and bucket under `.wrangler/`:

```sh
npm run db:migrate:local
npm run cms:to-cloudflare
npm run cf:build
npm run preview
```
