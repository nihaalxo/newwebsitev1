# Going live

One sitting, with Claude guiding. Nihaal signs in, types the password and creates the token; once signed in, anyone at
the keyboard can do the other clicks. Nothing is run on the Mac except Claude's one `git push` in step 6.

## Before the sitting (Claude, on this computer only)

- `redesign-static` is finished, in `/Users/nihalnazeer/nihaal/site-wt/static`.
- `npm run check`, `npm run build` and the checks in `README.md` (preview, end-to-end) pass.
- The work is committed, and nothing has been pushed.

## The sitting

1. **Nihaal** signs in to the Cloudflare dashboard (the account that holds nihaalnazeer.com) and to GitHub as
   nihaalxo.
2. **Pause the old site's builds.** Cloudflare > Workers & Pages > the Pages project that serves nihaalnazeer.com >
   Settings > Builds. If it builds from nihaalxo/newwebsitev1, pause automatic production deployments. The old site
   keeps serving.
3. **The media bucket.** R2 > Create bucket > `nihaalnazeer-media`. Then its Settings > Custom Domains > Add >
   `media.nihaalnazeer.com` > Connect Domain, and wait for Active. Leave the r2.dev public URL off. R2 already serves
   assets.nihaalnazeer.com, so it should not ask for payment. If it does, stop: adding a card is Nihaal's call.
4. **The admin bucket.** R2 > Create bucket > `nihaalnazeer-admin`. Private, no domain.
5. **Nihaal makes the GitHub token.** GitHub > Settings > Developer settings > Personal access tokens > Fine-grained
   tokens > Generate new token:
   - Name `nihaalnazeer.com publish`; Expiration: No expiration; Resource owner: nihaalxo.
   - Repository access: Only select repositories > newwebsitev1.
   - Repository permissions: Contents, Read and write (Metadata read comes with it). Nothing else.
   - Generate, and keep the page open: the token is shown once, and is pasted in step 8.
6. **Nihaal says the push may go ahead.** Claude runs `git fetch` to confirm origin/main has not moved, then
   `git push origin redesign-static:main`. It is a fast-forward: 234c778 (origin/main) is an ancestor.
7. **Create the Worker from the repository.** Workers & Pages > Create application > Import a repository > GitHub >
   nihaalxo/newwebsitev1 (if GitHub asks, Nihaal approves the Cloudflare app for this repository). Then:
   - Project name `nihaalnazeer` (it must match `wrangler.jsonc`); production branch `main`;
   - Build command: empty. Deploy command: `npm run ci`. Root directory: `/`;
   - API token: the default, created automatically. Builds for non-production branches: off.
   - Save and Deploy. The first build takes 3 to 4 minutes and publishes to `nihaalnazeer.<subdomain>.workers.dev`.
8. **The two secrets.** The nihaalnazeer Worker > Settings > Variables and Secrets > Add, type Secret:
   - `ADMIN_PASSWORD`: Nihaal makes a new long password in a password manager and pastes it.
   - `GITHUB_TOKEN`: the token from step 5.
9. **Test on the workers.dev address.**
   - Sign in at `/admin`, and let the password manager save the password.
   - Change one word in a project, Publish, and wait for "Live" (2 to 4 minutes). See it on the site, change it
     back, publish again.
   - In a new draft, upload one image and one film over 100 MB, preview it, then delete the draft.
   - Open the build log once (Deployments) and look for `status written`. If it says `status not written`, nothing
     breaks: the admin falls back to its 15-minute timeout.
10. **Move the domains.**
    - In the Pages project > Custom domains, remove nihaalnazeer.com and www.nihaalnazeer.com.
    - In DNS > Records, delete only the leftover A, AAAA or CNAME records for the apex and www. Leave interactive,
      assets, media, MX and TXT alone.
    - The nihaalnazeer Worker > Settings > Domains & Routes > Add > Custom Domain: nihaalnazeer.com, then
      www.nihaalnazeer.com.
11. **The go-live checks** (below).

**Pasted:** 2 values, `ADMIN_PASSWORD` and `GITHUB_TOKEN`.
**Created:** 2 R2 buckets, 1 R2 custom domain (media), 1 GitHub token, the Worker (through the import), 2 custom
domains on the Worker.
**Not needed:** `wrangler login`, Cloudflare API tokens, a deploy hook, D1, a CORS rule, R2 access keys, or any command
on the Mac besides the push.

## The go-live checks

- `curl -sI -H "Range: bytes=0-1" https://nihaalnazeer.com/films/lair-ship.mp4` prints 206 and
  `content-range: bytes 0-1/2818651`. The same on the media.nihaalnazeer.com film from step 9 prints 206.
- /about lands on /#about; /branding and /branding.html land on /work.
- /work/my-chaii-london opens its case file.
- /?from=lair skips the intro.
- The Lair links open https://interactive.nihaalnazeer.com/?film=on in a new tab.
- On an iPhone, the hero film, the Lair film and a media film play in Safari.
- In the first week: Workers & Pages > nihaalnazeer > Logs. Look at requests a day and CPU time per request against
  the margins below (the local timings are in the next section; `wrangler dev` does not enforce the CPU limit).

## Afterwards, outside this site

- The Lair's exit should go to https://nihaalnazeer.com/?from=lair. Its /about link is already covered by a 301.
- Keep the old Pages project paused, not deleted, for a week as a fallback, then delete it.

## Changing the password or the token

- **ADMIN_PASSWORD:** the nihaalnazeer Worker > Settings > Variables and Secrets > ADMIN_PASSWORD > edit, paste the new
  one, deploy. Sessions already signed in last up to 7 days; to end them now, sign in with the new password and choose
  **Sign out everywhere**.
- **GITHUB_TOKEN:** make the new token first (the same settings as step 5), replace the secret the same way, publish
  something small to see it work, then revoke the old token in GitHub (Settings > Developer settings > Fine-grained
  tokens). If the token expires or is revoked, publishing says so and drafts are kept; the live site is not affected.

## What could ever cost money

- **R2 storage above 10 GB.** The free tier is 10 GB-month across the account, and the Lair's bucket counts too. The
  admin's project list shows how much is used and warns above 7 GB, and **Tidy unused files** removes uploads no
  draft or published project uses. Class A and B operations have free allowances far above this site's use (below).
- Workers Free does not bill: past a limit it refuses requests instead (films answer 429 and rest on their posters;
  pages still load).
- What happens to builds on Free once the 3,000 build minutes of a month are used up is not documented. At about 4
  minutes a build, that is about 700 publishes a month.

## Free-plan margins

Estimates, to confirm in Workers Logs in the first week.

| Limit (Free) | This site |
| --- | --- |
| Static asset requests: free and unlimited | Every page, CSS and JS file, font and image. Admin uploads are on media.nihaalnazeer.com: 0 Worker requests |
| 100,000 Worker requests a day (reset 00:00 UTC; over it, 429 for `run_worker_first` paths) | Only the films in `public/` and the admin's API: about 12 to 25 per full home visit, so about 4,000 to 8,000 full visits a day |
| 10 ms CPU per request | Film ranges passed through: under 1 ms; mid-file slices of the 20.5 MB hero: a few ms. Measured locally in Node (`tests/cpu-proxy.ts`): state with 40 drafts 0.12 ms, a 405 KB draft save 0.68 ms, planning a 20-project publish 0.30 ms. Upload parts are streamed |
| 50 external subrequests, 1,000 to Cloudflare services | A publish makes about 9 GitHub calls, plus R2 calls |
| 100 MB request body | Film parts are 50 MiB |
| 64 MiB script | About 79 KiB (21 KiB gzipped) |
| 20,000 asset files, 25 MiB each | About 215 files; the largest is the tutorial film, 20.8 MiB |
| 2,000 static redirects; 100 `run_worker_first` entries; 100 `_headers` rules | 14 redirects plus one per renamed or removed project; 5 entries; 3 rules |
| R2: 10 GB-month, 1M Class A and 10M Class B operations a month | An image upload is about 2 Class A, a 500 MB film about 12, a draft save 1 |
| Workers Builds: 3,000 minutes a month, 1 build at a time, 20-minute timeout | About 4 minutes a build |

Sources (developers.cloudflare.com, read 9 Nov 2026):
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[static assets billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[static assets binding](https://developers.cloudflare.com/workers/static-assets/binding/),
[redirects](https://developers.cloudflare.com/workers/static-assets/redirects/),
[headers](https://developers.cloudflare.com/workers/static-assets/headers/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 multipart uploads](https://developers.cloudflare.com/r2/objects/multipart-objects/),
[Workers Builds limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/),
[Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
GitHub: [fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens).
