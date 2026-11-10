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
   While in R2, read the size of the Lair's bucket (the one behind assets.nihaalnazeer.com). The free 10 GB is shared,
   and the admin stops taking uploads at 8 GB (`STORAGE_CAP_BYTES` in `lib/cms/defaults.ts`), which leaves 2 GB for
   the Lair. If its bucket holds more than 2 GB, Claude lowers that cap by the difference and commits it before step 6.
4. **The admin bucket.** R2 > Create bucket > `nihaalnazeer-admin`. Private, no domain.
5. **Nihaal makes the GitHub token.** GitHub > Settings > Developer settings > Personal access tokens > Fine-grained
   tokens > Generate new token:
   - Name `nihaalnazeer.com publish`; Expiration: a custom date one year ahead (GitHub allows up to 366 days);
     Resource owner: nihaalxo. Put a reminder in a calendar a week before that date, to make the next one
     ("Changing the password or the token" below).
   - Repository access: Only select repositories > newwebsitev1.
   - Repository permissions: Contents, Read and write (Metadata read comes with it). Nothing else.
   - Generate, and keep the page open: the token is shown once, and is pasted in step 8.
   - Optional, if the repository's Settings offer it (Rules > Rulesets, or Branches): a rule for `main` that blocks
     force pushes and deletion. Leave ordinary pushes allowed: the admin and Claude both push to `main`.
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
11. **Optional: a rate limit on sign-in.** The admin already allows 5 wrong passwords per address every 15 minutes;
    this stops bursts before the Worker runs. nihaalnazeer.com zone > Security > WAF > Rate limiting rules > Create
    rule: when the URI Path equals `/api/admin/session`, with the same IP, more than 10 requests in 10 seconds, Block
    for 10 seconds. The Free plan has one such rule.
12. **The go-live checks** (below).

**Pasted:** 2 values, `ADMIN_PASSWORD` and `GITHUB_TOKEN`.
**Created:** 2 R2 buckets, 1 R2 custom domain (media), 1 GitHub token, the Worker (through the import), 2 custom
domains on the Worker; optionally a branch rule and a rate limiting rule.
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
  one, deploy. Every browser signed in with the old one is signed out at once and signs in again with the new one.
  **Sign out** in the admin also signs out every browser, not only the one it is clicked in.
- **GITHUB_TOKEN:** make the new token first (the same settings as step 5), replace the secret the same way, publish
  something small to see it work, then revoke the old token in GitHub (Settings > Developer settings > Fine-grained
  tokens). If the token expires or is revoked, publishing says the token was refused and drafts are kept; the live
  site is not affected.

## If GITHUB_TOKEN leaks

The token can write anything in newwebsitev1, not only `content/`, and every push to `main` is built and deployed. Code
pushed with it would run in the build, with the Workers Builds API token (account-wide Workers Scripts, KV and R2
edit, and Workers Routes on every zone, which reaches the Lair too), and on the site, with the Worker's secrets. So:

1. Revoke the token in GitHub (Settings > Developer settings > Fine-grained tokens).
2. Look at the commits on `main` for any not made by the admin ("Publish: …") or by Claude, and revert them.
3. Replace the Workers Builds API token: in the nihaalnazeer Worker's build settings (Settings > Build), choose a new
   API token, then delete the old one in My Profile > API Tokens.
4. Change `ADMIN_PASSWORD` (above), which also signs out every browser.
5. Check the Lair's Worker and the assets.nihaalnazeer.com bucket for changes.
6. Make a new token (step 5) and set it as `GITHUB_TOKEN`.

## What could ever cost money

- **R2 storage above 10 GB.** The free tier is 10 GB-month across the account, and the Lair's bucket counts too; past
  it R2 bills instead of refusing. The admin refuses uploads that would take its two buckets past 8 GB (both the
  one-request uploads and the films in parts, which must arrive no bigger than they said they were), warns from 7 GB,
  and **Tidy unused files** removes uploads no draft or published project uses. The Lair's bucket is checked at the
  sitting (step 3) and must stay under the 2 GB left to it.
- **R2 operations.** The free allowances (1M Class A, 10M Class B a month) are far above this site's use (below).
  The one way a stranger can make R2 operations is wrong passwords: each recorded failure is one write (Class A), and
  at most 300 are recorded an hour, about 223,000 a month. Many tries sent at the same instant can each still cost one
  refused conditional write, which R2 also bills as Class A, up to the Worker's 100,000 requests a day; the optional
  rate limiting rule (step 11) cuts those bursts down.
- Workers Free does not bill: past a limit it refuses requests instead (films answer 429 and rest on their posters;
  pages still load). The films in `public/` and the admin share the 100,000 Worker requests a day, so someone who
  spends them all closes the admin until 00:00 UTC; the site's pages are not affected.
- What happens to builds on Free once the 3,000 build minutes of a month are used up is not documented. At about 4
  minutes a build, that is about 700 publishes a month.

## Free-plan margins

Estimates, to confirm in Workers Logs in the first week.

| Limit (Free) | This site |
| --- | --- |
| Static asset requests: free and unlimited | Every page, CSS and JS file, font and image. Admin uploads are on media.nihaalnazeer.com: 0 Worker requests |
| 100,000 Worker requests a day (reset 00:00 UTC; over it, 429 for `run_worker_first` paths) | Only the films in `public/` and the admin's API: about 12 to 25 per full home visit, so about 4,000 to 8,000 full visits a day |
| 10 ms CPU per request | Measured locally on 10 Nov 2026 with a V8 profile of the Worker's isolate under `wrangler dev`, replaying the film requests of a real home visit: films passed through 0.03 to 0.10 ms; the hero's end range 0.85 ms and the hero from 0.9 MB to its end 2.2 ms (the slices are read in 1 MiB pieces); the Contact film's two ranges 0.55 and 1.0 ms; a whole visit's films 4.9 ms in all. A publish of 20 full case studies at once (580 media links) 5.9 to 7.1 ms. Tidy of 250 files (the most one request takes) 0.8 to 1.4 ms with 10 drafts; Tidy reads every draft, so with 128 drafts it was 10 to 12 ms. In Node (`tests/cpu-proxy.ts`): state with 40 drafts 0.12 ms, a 405 KB draft save 0.68 ms. Upload parts are streamed |
| 50 external subrequests, 1,000 to Cloudflare services | A publish makes about 9 GitHub calls (18 with one retry), one R2 listing per project folder and a few R2 reads and writes; Tidy at most 250 files and one read per draft |
| 100 MB request body | Film parts are 50 MiB |
| 64 MiB script | About 79 KiB (21 KiB gzipped) |
| 20,000 asset files, 25 MiB each | About 215 files; the largest is the tutorial film, 20.8 MiB |
| 2,000 static redirects; 100 `run_worker_first` entries; 100 `_headers` rules | 14 redirects plus one per renamed or removed project; 5 entries; 3 rules |
| R2: 10 GB-month, 1M Class A and 10M Class B operations a month | An image upload is about 2 Class A, a 500 MB film about 12, a draft save 1, a recorded wrong password 1. Uploads stop at 8 GB |
| `ctx.waitUntil`: up to 30 seconds after the answer is sent or the browser goes away | A publish whose browser closes still records itself, so the admin follows its build |
| WAF rate limiting on Free: 1 rule, by IP, 10-second period and block, matching the path | The optional sign-in rule (step 11) |
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
Read 10 Nov 2026:
[Workers context (waitUntil)](https://developers.cloudflare.com/workers/runtime-apis/context/),
[R2 Workers API (conditional writes, list, multipart metadata)](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[R2 pricing, again (a refused conditional write is Class A)](https://developers.cloudflare.com/r2/pricing/),
[ReadableStreamBYOBReader](https://developers.cloudflare.com/workers/runtime-apis/streams/readablestreambyobreader/),
[rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[Workers Builds configuration, again (the build token's permissions)](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
GitHub: [fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens),
[personal access tokens (expiry)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
