# best-albums-headless-astro

Local-first headless CMS for **[bestalbumsintheuniverse.com](https://bestalbumsintheuniverse.com)**.

Albums are markdown files edited locally with [Keystatic](https://keystatic.com). The build compiles
them into a legacy-shaped `albums.json` (consumed by the existing static front-end, vendored into
`public/`) plus a [Gemini](https://geminiprotocol.net/) capsule. **No database, and no server to run
unless you're editing** — the deployed site is pure static assets on Cloudflare.

## How it fits together

```
                        Keystatic (dev only)  ──edits──┐
                                                       ▼
  npm run new-album <QID> ──────────────▶  src/content/albums/*.md   (+ public/covers/)
  npm run import (one-shot migration) ──▶
                                                       │
                         ┌─────────────────────────────┴───────────────────────────┐
                         ▼                                                           ▼
   astro build → dist/  (vendored front-end + albums.json + covers)       npm run build:gem → _gem/
                         │                                                  (gemdown → .gmi)
            push to main │ Cloudflare Worker build-on-push                  │ npm run deploy:gem (rsync)
                         ▼                                                  ▼
            bestalbumsintheuniverse.com (Worker, static)        gem.bestalbumsintheuniverse.com
```

- **Astro is a build tool here, not a rendered site.** It hosts Keystatic in dev and compiles the
  markdown into `albums.json`. The actual web UI is the original front-end (jQuery + Mustache +
  Masonry), vendored unchanged into `public/`, which fetches `/albums.json` at runtime.
- **Keystatic + React are dev-only.** They're excluded from production builds (gated on `NODE_ENV`
  in `astro.config.mjs`), so the deployed Worker serves only static HTML / JSON / images — no editor.

## Prerequisites

Node ≥ 22.12 (pinned to `22.22.2` in `.tool-versions` and `.node-version`).

```sh
npm install
```

## Local editing

```sh
npm run dev        # http://localhost:4321 (or next free port)
```

In dev the homepage **redirects to `/keystatic`** — the CMS. Edit albums there; changes are written
straight to `src/content/albums/*.md`. The vendored front-end is served at the same origin, and
`/albums.json` is generated live.

## Album schema

Each `src/content/albums/<slug>.md` is YAML frontmatter + a markdown body (the description):

| Field | Type | Notes |
|---|---|---|
| `title` | string | album title (Keystatic slug field) |
| `artist` | string | |
| `added` | string (ISO 8601) | **sort key** — newest shown first; quoted so Keystatic (YAML 1.1) reads it as a string |
| `date` | string (optional) | release date; accepts partial `YYYY` / `YYYY-MM` |
| `link` | string (optional) | MusicBrainz / AllMusic / Amazon |
| `spotifyId` | string (optional) | builds the Spotify link/embed |
| `mbid` | string (optional) | MusicBrainz release-group id |
| `qid` | string (optional) | Wikidata id (re-lookup) |
| `cover` | string | path under `public/covers/` |
| *body* | markdown | rendered to HTML for `albums.json`, to gemtext for the capsule |

`albums.json` is emitted by `src/pages/albums.json.js` in the legacy shape the front-end expects
(`artist, album, link, spotify_id, photo_url_sm, photo_url_lg, timestamp, slug, mini-slug, html`).
The front-end sorts by `timestamp` (descending) client-side.

## Adding albums

- **From a Wikidata QID (the fast path):**

  ```sh
  npm run new-album Q202996      # e.g. OK Computer
  ```

  Fetches title / artist / date / MBID / Spotify id / link from Wikidata and downloads the cover from
  the Cover Art Archive, then writes the `.md` with an empty body. Open Keystatic to write the
  description.

- **By hand:** create the entry in Keystatic, or drop a `.md` into `src/content/albums/`.

### Covers

Full covers live in `public/covers/<slug>.<ext>` (committed). Thumbnails (`public/covers/sm/<slug>.jpg`,
gitignored) are generated at build by `scripts/covers-thumbs.mjs`, keyed by album slug.

## Building & deploying the web site

```sh
npm run build      # node scripts/covers-thumbs.mjs && astro build  → dist/
npm run preview    # build, then serve via `wrangler dev`
```

The site is a **Cloudflare Worker** (`best-albums`) connected to this repo with **build-on-push**:

- **Push to `main` → Cloudflare builds and deploys automatically.** Build settings (CF dashboard):
  build command `npm run build`, deploy command `npx wrangler deploy`.
- Uses the `@astrojs/cloudflare` adapter + `wrangler.jsonc` (assets served from `dist`). Everything is
  prerendered, so the Worker just serves static assets.
- `bestalbumsintheuniverse.com` and `www` are **Worker custom domains** (proxied).
- Manual deploy from your machine, if ever needed: `npm run deploy`.

> **Gotcha — `wrangler` must be a regular `dependency`, not a `devDependency`.** Cloudflare's build
> runs with `NODE_ENV=production`, so `npm ci` omits dev dependencies. If `wrangler` is a devDep the
> deploy step fails with `wrangler: not found`. (Same reason Keystatic/React are safely excluded:
> the build's `NODE_ENV=production` flips the `isDev` gate in `astro.config.mjs`.)

## Gemini capsule

```sh
cp .env.example .env     # fill in GEM_USER / GEM_HOST (one time)
npm run build:gem        # render _gem/ via gemdown (md2gemini), newest-first
npm run deploy:gem       # rsync _gem/ to the capsule host
```

`deploy-gem.sh` sources `.env` for `GEM_USER` / `GEM_HOST` / `GEM_PATH` (or pass them inline). The host
is reached over SSH via your `~/.ssh/config` (passwordless), and `GEM_PATH` (default
`/var/gem/best-albums`) must be **writable by `GEM_USER`**. Files are published world-readable for the
Gemini daemon serving `gem.bestalbumsintheuniverse.com`.

> `admin.bestalbumsintheuniverse.com` is the SSH host for gem deploys — don't remove its DNS record.

## One-shot production migration

Used once to seed content from the old Rails app's database. Dump the production DB (read-only),
then import:

```sh
mkdir -p scripts/data
ssh admin.bestalbumsintheuniverse.com \
  "cd /var/www/best-albums-headless/current && bin/rails runner 'puts Album.all.map { |a| \
     a.attributes.merge(cover_download_url: (a.cover.attached? ? a.cover.url : a.cover_url)) }.to_json'" \
  > scripts/data/production-albums.json   # Ruby env via RVM; run as the deploy user (owns master.key)

npm run import   # writes one .md per album (slug preserved), downloads covers
```

`scripts/data/` is gitignored. Slug-based filenames naturally de-duplicate true duplicates.

## Tests

```sh
npm test          # node --test
```

Covers the pure logic: slug generation, the album reader, the legacy-json mapper, cover thumbnails,
Wikidata parsing, the frontmatter writer, the Gemini renderer, and the import row mapper.

## Project structure

```
astro.config.mjs        # react()+keystatic() in dev only; @astrojs/cloudflare adapter
keystatic.config.ts     # local CMS schema (dev only)
wrangler.jsonc          # Cloudflare Worker config (assets = dist)
.env / .env.example     # GEM_USER / GEM_HOST for deploy:gem (.env is gitignored)
src/
  content/albums/*.md   # the albums (source of truth)
  lib/                  # albums reader, slug, legacy-json, wikidata, gemini (pure, tested)
  pages/albums.json.js  # emits the legacy-shaped albums.json
public/                 # vendored front-end (index.html, css, js, tmpl) + covers/
scripts/                # new-album, import, covers-thumbs, build-gem, deploy-gem, lib/
docs/superpowers/       # the original design spec + implementation plan
test/                   # node:test suites + fixtures
```
