# Cloud9 Med Spa website

Bilingual (English + Spanish) site for Cloud9 Med Spa, 11751 Alta Vista Rd, Suite 303, Fort Worth, TX 76244.
Astro (static) plus one serverless function for leads. Built to deploy on Vercel.

- `PRODUCT.md`: audience, voice, main action, constraints
- `DESIGN.md`: palette, type, radius, motion, the signature moment and the plan tool
- `_source/RESEARCH.md`: every fact gathered, where it came from, and what still needs confirming

## Editing content (no code needed)

Everything a person might change lives in `src/content/`:

| File | What it holds |
|---|---|
| `site.json` | Phone, email, address, hours, map links, rating, socials. `"verified": false` items show only in review builds. |
| `services.json` | Treatment menu: name, price, minutes, which skin layer it belongs to, downtime, descriptions in EN and ES. `name_es` is optional. |
| `memberships.json` | Botox, Luxe and Glow Clubs. |
| `team.json` | Team bios. Set `photo` to e.g. `/media/team/sara.jpg` once a real portrait exists. |
| `reviews.json` | Real reviews only, word for word, first name + last initial, link to the source. |
| `media.json` | Real hero video and testimonial videos once they exist (see below). |
| `en.json`, `es.json` | Every sentence on the site, per language. |

Photos and video go in `public/media/`. Hero loop: H.264 MP4, silent, under 2 MB, with a JPG poster.

## Review build vs live build

`SITE_MODE` controls this (default `review`):

- **review**: yellow banner, UNVERIFIED tags on anything not yet confirmed, `noindex` everywhere, robots.txt blocks all crawlers.
- **production**: unverified items are removed (not just untagged), unverified rating and coordinates are left out of schema.org, pages become indexable, robots.txt allows crawling (except `/front-desk/` and `/api/`).

When launching: set `SITE_MODE=production` and `SITE_URL=https://cloudninemedspadfw.com` in Vercel, and delete the
first `X-Robots-Tag: noindex` header block in `vercel.json`.

## Leads

Both the plan tool and the call-back form post to `api/lead.js`. Configure delivery with environment variables in Vercel:

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key, for email delivery |
| `LEAD_EMAIL_TO` | Where leads are emailed (comma-separated for several) |
| `LEAD_EMAIL_FROM` | Optional verified sender, e.g. `Cloud9 Website <web@cloudninemedspadfw.com>` |
| `LEAD_WEBHOOK_URL` | Optional: Zapier, Make, n8n, CRM or Google Sheets webhook. Receives the lead as JSON. |

Until one of these is set, every lead is still written to the function log: Vercel > Project > Logs, search `LEAD`.
If delivery is set up but every channel fails, the visitor sees an error with the phone number, so no lead is silently lost.

Spam protection: a hidden honeypot field, plus server-side checks (name, 10-digit US phone, consent).

### Reference codes and the front desk

The plan tool gives each visitor a code like `C9-LV-FE-1NE-K`. Staff open `/front-desk/` (not linked anywhere, noindex),
type in the code the caller reads out, and see their answers and the plan they were shown. The last letter is a check
letter that catches a misheard character. `/front-desk/?code=C9-LV-FE-1NE-K` also works, so the code in a lead email can be a link.

## Commands

```bash
npm install
npm run dev        # local development
npm run build      # production build into dist/
npm run preview    # serves dist/ and runs the lead function locally on :4321
npm run qa         # full automated QA in headless Chromium (screenshots in qa-report/)
```

## Deploying to Vercel

1. Import the GitHub repository in Vercel and set **Root Directory** to `cloud9-medspa`.
2. Framework preset: Astro (detected from `vercel.json`). The `api/` folder becomes the serverless function.
3. Add the environment variables above. Leave `SITE_MODE` unset for the review link.
4. Every push to the branch redeploys to the same URL.

## Where things live

```
src/pages/            index (EN), es/ (ES), front-desk/, 404, robots.txt, sitemap.xml
src/components/       one component per section; Art.astro holds the illustrations
src/lib/plan.js       plan tool logic and reference-code encode/decode (shared by browser, front desk and API)
src/scripts/          browser code: main.js (reveals, nav, depth diagram), sky.js (WebGL hero), planner.js, forms.js
src/styles/global.css all styling, tokens at the top
api/lead.js           lead function
tests/qa.mjs          automated QA
```
