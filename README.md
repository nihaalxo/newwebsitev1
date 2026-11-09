# nihaalnazeer.com

The portfolio of Nihaal Nazeer, designer. A dark, film-led site: the hero film, a few highlighted case studies with the
rest of the work listed under them, the Lair (the walk-through 3D portfolio at interactive.nihaalnazeer.com), About and
Contact, plus an All projects page with every case study. Every case study and most of the site's text is edited in a
password-protected admin at `/admin`, so nothing needs a developer once it is live.

Built with Next.js 15 (App Router), React 19 and plain CSS. Content is stored in one of two places:

- **Local mode** (on your computer): a JSON file, `.cms/content.json`, and uploaded files in `public/uploads/`.
- **Supabase mode** (the live site): a free Supabase project for the database, the uploaded files and the admin login.

The site switches to Supabase mode by itself as soon as the two `NEXT_PUBLIC_SUPABASE_*` variables are set.

## Run it on your computer

You need [Node.js](https://nodejs.org/) 20 or newer.

1. In a terminal, in this folder:
   ```sh
   npm install
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in the local-mode lines:
   - `ADMIN_EMAIL`: the email you'll sign in with.
   - `ADMIN_PASSWORD`: any password; it only protects your own computer.
   - `LOCAL_SESSION_SECRET`: a long random string. Make one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

   Leave the Supabase lines empty for now.
3. Start it:
   ```sh
   npm run dev
   ```
4. Open http://localhost:3000 for the site and http://localhost:3000/admin to edit it.

Other commands: `npm run typecheck` checks the code, `npm run build` then `npm start` runs the production build.

## Add a project

1. Go to `/admin`, sign in and choose **New project**.
2. Give it a title and a web address (the last part of the URL, e.g. `my-chaii-london`: lowercase letters, numbers and
   hyphens), a category, year, discipline and a one-sentence summary.
3. Add a cover image, pick the colour the case study is lit with, and build the page from text, image, gallery,
   video and quote blocks. Images are converted to WebP in your browser before they upload.
4. Save it as a draft and use **Preview** to see it exactly as visitors will. Drafts never appear on the public site.
5. Publish it. Turn on **Highlight** to give it a large plate on the home page, up to three at a time; otherwise it
   is listed under the highlights. **View all projects** on the home page opens the All projects page, where every
   published project gets a plate. Change the order in the project list.

## How local mode works

- Everything you edit is written to `.cms/content.json`, and uploads go to `public/uploads/`. Both are meant to be
  committed to git: they *are* the site's content until you move to Supabase.
- Editing only works under `npm run dev`. A deployed copy without Supabase still shows whatever was committed, but
  it is read-only, because a server's disk forgets changes.
- The starting content comes from `scripts/catalogue.json` (all 21 projects, their summaries and image descriptions)
  and the project images in `public/`. `npm run cms:seed` builds `.cms/content.json` and the WebP images in
  `public/uploads/seed/` from them. It refuses to run if `.cms/content.json` exists, because that would throw away
  your edits; `npm run cms:seed -- --force` rebuilds it anyway.

## Going live

Do these once, in order. It takes about half an hour, and everything here is free on personal plans.

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) with your personal account and create a **New project**. Pick the
   London region if it's offered, and keep the database password somewhere safe (you won't need it day to day).
2. Open **SQL Editor**, start a **New query**, paste in the whole of `supabase/migrations/0001_init.sql` and press
   **Run**. This creates the tables, the security rules and the `media` storage bucket. It is safe to run again.

   If your project was set up from an earlier copy of this file, run it again now. Older copies let anyone list
   every file in the `media` bucket, including the images of projects that are still drafts.

### 2. Make your admin login

1. Go to **Authentication > Users > Add user > Create new user**. Enter your email and a strong password, and tick
   **Auto Confirm User**.
2. Go to **Authentication > Sign In / Providers** and turn off **Allow new users to sign up**, then save. Nobody else
   can now make an account.
3. Back in the **SQL Editor**, run this with your own email:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
   Only accounts listed in `admins` can edit the site.

### 3. Copy your content up

1. In Supabase, open **Project Settings > API Keys** (on older dashboards, **Project Settings > API**). Put these in
   `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: the Project URL, like `https://abcdefgh.supabase.co`.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the **anon** or **publishable** key. This one is public by design.
   - `SUPABASE_SERVICE_ROLE_KEY`: the **service_role** or **secret** key. It can do anything to your project: keep
     it in `.env.local` only, never paste it into Vercel or share it.
2. Run:
   ```sh
   npm run cms:push
   ```
   It uploads every image and film the content uses to Supabase Storage, points the content at those copies, and
   saves all the projects and site settings. Add `-- --dry-run` to see what it would do first. Running it again is
   safe: files already uploaded are skipped and projects are matched by their web address.
3. Restart `npm run dev`. The site now reads from Supabase, and `/admin` takes your Supabase email and password.

### 4. Put it on Vercel

1. Push this repository to GitHub.
2. At [vercel.com](https://vercel.com), on your personal account, choose **Add New > Project** and import the
   repository. Vercel recognises Next.js by itself.
3. Under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the same
   values as in `.env.local`), plus `NEXT_PUBLIC_SITE_URL` = `https://nihaalnazeer.com`. Not the service role key,
   and not the `ADMIN_*` lines.
4. Press **Deploy** and check the `*.vercel.app` address it gives you, including `/admin`.

### 5. Point nihaalnazeer.com at Vercel

1. In Vercel, open the project's **Settings > Domains** and add `nihaalnazeer.com` and `www.nihaalnazeer.com`. Vercel
   shows the DNS records it wants.
2. If the domain is attached to the old Cloudflare Pages project, remove it there first (**Workers & Pages >** the
   project **> Custom domains**).
3. In Cloudflare, open the domain's **DNS > Records**. Replace the records for `nihaalnazeer.com` and `www` with the
   ones Vercel showed (usually an `A` record for the bare domain and a `CNAME` for `www`), and set their proxy status
   to **DNS only** (grey cloud) so Vercel can issue the HTTPS certificate. Leave the `interactive` record alone: that
   is the Lair.
4. Wait until Vercel shows both domains as valid. That's usually minutes, occasionally a few hours.

From then on, edit the site at `nihaalnazeer.com/admin`. Saved changes appear on the public pages straight away.

### Afterwards

- **Make the hero film lighter.** `finalheroshot.compressed.mp4` is about 20 MB and is most of what a first visit
  downloads. Re-export it as an H.264 MP4 of 1–1.5 MB (1280–1920 px wide, at a lower bitrate) and upload it in the
  admin under **Site settings**. If the new cut starts differently, change the hero film's start time there too.
  The film loops between **Loop from** and **Loop to**, so any black at its start or end never leaves the first
  screen empty. Replacing the film sets both back to 0, which plays the whole film, so set them again for the new cut.
- **Free-plan pausing.** Supabase may pause free projects that see no activity for a while; check their current
  rules. A paused project stops serving the images and films until you press **Restore** in its dashboard.

### About Cloudflare hosting

The old site was deployed to Cloudflare Pages with `@cloudflare/next-on-pages`. That setup has been removed: it
needed every server route to run on Next's edge runtime, and Cloudflare has since deprecated it in favour of OpenNext.
To host on Cloudflare instead of Vercel you would need the OpenNext Cloudflare adapter (`@opennextjs/cloudflare`),
which isn't configured here. DNS can stay on Cloudflare either way.

## Where things are

| Path | What it is |
| --- | --- |
| `app/(site)/`, `components/site/` | The public site |
| `app/admin/`, `components/admin/` | The admin |
| `lib/cms/` | The content model (`types.ts`) and both storage modes (`local.ts`, `supabase.ts`) |
| `lib/supabase/`, `middleware.ts` | Supabase clients, and the session refresh for `/admin` |
| `app/api/cms/local-upload/` | Receives uploads in local mode |
| `supabase/migrations/0001_init.sql` | Database, security rules and storage bucket |
| `scripts/` | `catalogue.json`, `seed-local.mjs` (`npm run cms:seed`), `push-to-supabase.mjs` (`npm run cms:push`) |
| `.cms/content.json`, `public/uploads/` | Local-mode content and uploads |
