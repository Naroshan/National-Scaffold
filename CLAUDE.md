# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The live source for **nationalscaffold.co.uk** — a UK scaffolding lead-generation site. Plain static HTML/CSS/JS
(no framework, no build step, no bundler) deployed on Netlify. `netlify.toml` sets `publish = "."`, so whatever
is committed is what ships; there is nothing to compile.

## Commands

There is no build, lint, or test tooling in this repo (`package.json`'s `test` script is a placeholder that
always fails; `@netlify/edge-functions` is a devDependency only for editor type-checking of the edge function).

- **Preview locally**: `python3 -m http.server 8000` from the repo root, or open the HTML files directly.
- **Deploy**: push to the branch Netlify is watching — there is no separate build/publish command.
- **Verify a change didn't break rendering**: there's no test suite, so check by rendering the page (a headless
  browser works well since the site has no login/state) — parse the HTML, check for console errors, and diff
  visible content against what changed.

## Architecture

### Page templates (three, applied inconsistently across `/locations/`)

`/locations/*.html` holds ~1,005 programmatic-SEO pages, one per service+city combination (e.g.
`chimney-scaffolding-barnet.html`, `roof-scaffolding-se19.html`). They are **not** generated from a shared
template at build time — each is a static, independently-editable file, and they come from three distinct
hand-authored templates mixed throughout the folder:

1. **Modern template** (~938 pages) — yellow/black theme, full `Service` JSON-LD schema, floating WhatsApp
   button (hidden on mobile via `@media (max-width:640px){.wa-float{display:none}}` since the sticky bottom
   bar already covers WhatsApp there), `<h1>{Service}<br><span>{City}</span></h1>`.
2. **Legacy template** (~67 pages) — older orange/white-ish design, no floating WhatsApp button,
   `<h1>{Service}<br>{City}</h1>` (no inner `<span>`).
3. A **third city-only variant** folded into the legacy set, e.g. `scaffolding-chelsea.html`, with
   `<h1>{Service}<br><span>{City}</span><br>Fixed Price</h1>`.

Because there's no shared template, **any sitewide fix has to be scripted across all three variants** rather
than edited once — see recent commit history for the pattern (Python/regex passes over `locations/*.html`
guarded by before/after counts, e.g. de-duplicating GTM, backfilling schema, hiding `.wa-float` on mobile).
When adding a new location page, copy the closest existing page in the same service family rather than
inventing new markup.

### The Netlify Edge Function is the one shared layer

`netlify/edge-functions/gtm-inject.ts` runs on every HTML response (`path: "/*"`, static assets excluded) and
does two things by string-replacing the response body:

1. Injects the GTM container (`GTM-K588VLD8`) into `<head>`/`<body>` sitewide, so individual pages should
   **not** hardcode their own GTM script — if you find one that does, it's a bug (duplicate firing), not a
   feature to preserve.
2. Hides contact methods (`tel:` links, `wa.me` links, `#enquiry` links, the enquiry form, `.sticky-bar`) for
   visitors whose geo-IP data clearly places them outside England & Wales, since the business only serves
   those two nations. Known crawler user-agents are always exempted (see `BOT_UA_PATTERN`) so this can't look
   like cloaking to Google. Ambiguous/missing geo data fails **open** (contact stays visible) — see the
   comments in that file before changing the England/Wales detection logic.

### Lead capture flow

Every enquiry form (`form[action*="formspree.io"]`, endpoint `formspree.io/f/xgornado`) submits directly to
Formspree with a hidden `_next` field pointing at `/thank-you.html`. That page is the single place conversion
events fire (`gtag('event','generate_lead',...)` and `fbq('track','Lead')`) — it's deliberately not done via a
JS submit-handler on every form, since that would race the page navigation. If you add a new form anywhere,
give it the same `action` and `_next` value or it won't be tracked and won't redirect anywhere sensible.

### URL canonicalization

`_redirects` 301-redirects the non-`.html` and non-root variants of top-level pages (`/commercial-scaffolding`,
`/blog`, `/locations`, `/thank-you`, etc.) to their canonical `.html`/`/` form. `sitemap.xml` and internal links
should always use the canonical (`.html`) form to avoid an extra redirect hop.

### Internal linking

`locations.html` contains a generated `<details>`-per-service directory linking to all ~1,005 location pages
(grouped by service, collapsed by default) — this exists because the page used to link to only 8 of them,
leaving the rest reachable only via `sitemap.xml` with no internal link path. Any new location page must be
added to this directory as well as to `sitemap.xml`, or it becomes orphaned again.

### SEO/tracking surface

`llms.txt`, `robots.txt`, and `sitemap.xml` are hand-maintained, not generated. Meta descriptions across
`/locations/*.html` are kept under 160 characters (Google truncates longer ones in search results) — check new
ones against that limit. Analytics/ads IDs in use: GTM `GTM-K588VLD8`, Google Ads `AW-18109980077`, GA4
`G-GM17KVVQ6Q`, Meta Pixel `1883591939017582`.
