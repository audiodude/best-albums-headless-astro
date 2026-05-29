# Best Albums Headless → Astro: Design Spec

- **Date:** 2026-05-29
- **Status:** Draft for review
- **Target repo:** `~/code/starred/best-albums-headless-astro` (new sibling, to be created during implementation)
- **Supersedes:** the Rails app at `~/code/starred/best-albums-headless`
- **Reference template:** `~/code/vibes/null.dangerthirdrail.com` (Astro + Keystatic, local-first)

## 1. Goal

Replace the Rails headless CMS with a **local-first Astro + Keystatic** setup that:

- stores each album as a markdown file with YAML frontmatter (no database),
- is edited 100% locally via Keystatic (never deployed),
- compiles the content into a legacy-shaped `albums.json` consumed by the **existing, unchanged** front-end, and
- compiles a Gemini capsule (`.gmi`) via `gemdown`.

The deployable web output is a single static bundle (vendored front-end + generated `albums.json` + cover images) served by a static host (Cloudflare Pages).

## 2. Motivation

- **No standing hosting cost.** Today a Rails app + MySQL run 24/7 just to occasionally edit albums. In the new model nothing runs unless the maintainer is editing locally; the public site is static files on a CDN.
- **Simpler architecture.** Content lives in git as markdown; the "CMS" is a dev-only tool.
- **Proper static hosting** (Cloudflare Pages / Netlify) instead of a self-managed VPS + nginx + Passenger + Capistrano.

## 3. Non-goals

- **Not** rebuilding or restyling the front-end — it is vendored from `github.com/audiodude/best-albums` and consumes `albums.json` exactly as it does today.
- **No** public Astro-rendered album pages, and **no** React on the public side (React is pulled in only because Keystatic requires it, and is excluded from production builds).
- **No** authentication (there is no deployed admin surface).
- **Not** provisioning a Gemini server — the existing Gemini host is reused; this repo only produces the `.gmi` artifact and a deploy command.
- **No** object storage — covers are bundled in the repo (finite, curated set).

## 4. Architecture overview

```
                        ┌─────────────────────────────────────┐
   (one-shot)           │  Local machine (only when editing)   │
 production DB ──ssh──▶ │                                      │
 admin.bestalbums...    │   Keystatic (dev only, /keystatic)   │
                        │            ▲   ▼                     │
                        │   src/content/albums/*.md  ◀──┐      │
                        │            │                  │      │
                        │   new-album <QID> ────────────┘      │
                        │            │ (Wikidata + cover dl)   │
                        └────────────┼─────────────────────────┘
                                     │ astro build (NODE_ENV=production)
                          ┌──────────┴───────────┐
                          ▼                       ▼
                 dist/albums.json        npm run build:gem
                 dist/covers/**          → _gem/**.gmi  (gemdown)
                 dist/<vendored FE>             │
                          │                     │ rsync
                          ▼                     ▼
                 Cloudflare Pages        existing Gemini server
                 (existing front-end           (/var/gem/best-albums)
                  fetches /albums.json)
```

## 5. Repo layout

```
best-albums-headless-astro/
  astro.config.mjs            # react() + keystatic() integrations, keystatic dev-only
  keystatic.config.ts         # local CMS schema (storage: { kind: 'local' })
  package.json
  .tool-versions              # pin Node (>= 22.12, matching reference)
  src/
    content.config.ts         # Astro content collection + Zod schema (mirrors Keystatic)
    content/albums/*.md        # album files (Keystatic-managed, the source of truth)
    pages/
      albums.json.js           # static endpoint → dist/albums.json (legacy shape)
  public/
    <vendored front-end>       # index.html, css/, js/, mustache template (from audiodude/best-albums)
    covers/<slug>.<ext>        # full cover images (committed)
    covers/sm/<slug>.jpg       # thumbnails (generated at build, not committed)
  scripts/
    lib/wikidata.mjs           # shared Wikidata fetch + parse
    lib/covers.mjs             # shared cover download + sharp thumbnail helper
    new-album.mjs              # QID → scaffold .md + download cover
    import.mjs                 # production DB JSON → .md files + covers (one-shot)
    covers-thumbs.mjs          # ensure every full cover has a /covers/sm thumbnail
    build-gem.mjs              # render Gemini capsule via gemdown
  .githooks/pre-push           # (optional) block push if an album's cover file is missing
  .github/workflows/deploy.yml # build + deploy to Cloudflare Pages on push to main
```

## 6. Content model

Each `src/content/albums/<slug>.md` has frontmatter + a markdown body (the description). The schema is declared in **both** `keystatic.config.ts` (editor) and `src/content.config.ts` (Zod, for `getCollection`), kept in agreement.

| Field | Type | Required | Source on migration | Notes |
|---|---|---|---|---|
| `title` | string | yes | DB `title` | Keystatic `slugField` |
| `artist` | string | yes | DB `artist` | |
| `added` | string (ISO 8601 datetime) | yes | DB `created_at` | sort key; full precision preserved for the front-end's `timestamp` |
| `date` | date | no | DB `date` | release date; editor metadata, not published |
| `link` | string | no | DB `link` | MusicBrainz / AllMusic / Amazon |
| `spotifyId` | string | no | DB `spotify_id` | builds the Spotify link |
| `mbid` | string | no | DB `mbid` | MusicBrainz release-group id |
| `qid` | string | no | DB `qid` | Wikidata id (enables re-lookup) |
| `cover` | image | no | downloaded from DB cover URL | stored at `public/covers/<slug>.<ext>`; optional so the QID-first workflow (scaffold now, add cover later) validates |
| *(body)* | markdown | no | DB `description` | Keystatic `contentField`; rendered to HTML for `albums.json` |

**Dropped from the Rails model:** the stored `html` column (rendered at build now), Devise `users`, all ActiveStorage tables.

**Slug:** the filename is the album slug. Migrated files **preserve the existing production slug** (so URLs and Gemini paths don't change). New albums (CLI or Keystatic) derive a slug as `parameterize("<artist> <title>")` truncated to the first 4 tokens — matching the old `Album#update_slug` rule.

### `added` / Keystatic note

Keystatic core has a `date` field but no datetime field. To preserve exact ordering (the front-end may sort by `timestamp`, and same-day albums must keep order), `added` is stored as a full ISO 8601 string in a Keystatic **text** field, populated by the scripts (migration from `created_at`, `new-album` from current time). This is a minor editing wart accepted for fidelity.

## 7. Units

Each unit below states **what it does / how it's used / what it depends on**.

### 7.1 Keystatic config (`keystatic.config.ts`)
- **Does:** defines the local CMS — `storage: { kind: 'local' }`, one `albums` collection at `src/content/albums/*`, `slugField: title`, `format: { contentField: description }`, columns `['title', 'artist', 'added']`, and the field schema from §6 (incl. `fields.image` for `cover` with `directory: 'public/covers'`, `publicPath: '/covers/'`).
- **Used by:** the Keystatic UI at `http://localhost:4321/keystatic` in dev.
- **Depends on:** `@keystatic/core`, `@keystatic/astro`, React integration.

### 7.2 Content collection (`src/content.config.ts`)
- **Does:** defines the `albums` collection via `glob({ pattern: '*.md', base: './src/content/albums' })` with a Zod schema mirroring §6.
- **Used by:** the `albums.json` endpoint and `build-gem.mjs` via `getCollection('albums')`.
- **Depends on:** `astro:content`.

### 7.3 `albums.json` endpoint (`src/pages/albums.json.js`)
- **Does:** `getCollection('albums')`, renders each body markdown → HTML (via `marked`), and returns the **exact legacy shape** (see §8). Astro emits it as `dist/albums.json` at build.
- **Used by:** the vendored front-end (`fetch('/albums.json')`).
- **Depends on:** `astro:content`, `marked`.

### 7.4 Cover pipeline (`scripts/lib/covers.mjs`, `scripts/covers-thumbs.mjs`)
- **Does:** `lib/covers.mjs` downloads a cover URL to `public/covers/<slug>.<ext>`. `covers-thumbs.mjs` walks `public/covers/*` and, for any cover lacking a `public/covers/sm/<slug>.jpg`, generates a ~90×80 (resize-to-fit, aspect-preserving) thumbnail with `sharp` — idempotent, skips existing. Runs as a build prestep so Keystatic-uploaded covers also get thumbnails.
- **Used by:** `import.mjs`, `new-album.mjs` (download); `build` script (thumbnails).
- **Depends on:** `sharp`, Node `fetch`.

### 7.5 `new-album <QID>` CLI (`scripts/new-album.mjs`, `scripts/lib/wikidata.mjs`)
- **Does:** ports `AlbumsController#wikidata` to Node. Fetches `https://www.wikidata.org/wiki/Special:EntityData/<QID>.json`, maps properties (§9), resolves the artist label via a second lookup, applies the resilient partial-date handling, downloads the cover from Cover Art Archive by MBID, and writes a new `src/content/albums/<slug>.md` with fields pre-filled and an empty body. The maintainer then writes the description in Keystatic.
- **Used by:** `npm run new-album Q12345`.
- **Depends on:** `lib/wikidata.mjs`, `lib/covers.mjs`, Node `fetch`.

### 7.6 `import` migration CLI (`scripts/import.mjs`)
- **Does:** one-shot, idempotent (keyed by slug). Reads `scripts/data/production-albums.json` (produced per §10) and, for each album, writes `src/content/albums/<slug>.md` preserving the slug, mapping all fields per §6, and downloading the cover from `cover_download_url` into `public/covers/`.
- **Used by:** `npm run import` (run once during the cutover).
- **Depends on:** `lib/covers.mjs`.

### 7.7 Gemini build & deploy (`scripts/build-gem.mjs`, `scripts/deploy-gem.sh`)
- **`build-gem.mjs`:** `getCollection('albums')`, renders each description body through `gemdown`'s `md2gemini`, and writes `_gem/index.gmi` (list, newest-first by `added`) + `_gem/<slug>/index.gmi` per album (header, Spotify link, "Added <date>", description gemtext) — same structure as the old Rake `deploy_gem`. Run via `npm run build:gem`.
- **`deploy-gem.sh`:** builds `_gem/` then `rsync -az --delete _gem/ "$GEM_USER@$GEM_HOST:$GEM_PATH/"`. Run via `npm run deploy:gem`.
  - Requires `GEM_USER` and `GEM_HOST` **env vars, passed per-invocation** (e.g. `GEM_USER=… GEM_HOST=… npm run deploy:gem`), exactly matching the maintainer's existing Gemini-deploy convention (`travisbriggs.com/deploy_gemini.sh`). A passwordless `~/.ssh/config` host alias already covers the host. **No host/user values are committed to the repo** — they live only in the environment + `~/.ssh/config`.
  - Uses `rsync -az --delete` (per request) instead of the older tar + `scp` + server-side `mv` swap.
  - `GEM_PATH` is the remote capsule directory; defaults to the existing target (the old Rake task wrote `/var/gem/best-albums/`). **Confirm the path and that `$GEM_USER` can write there** — if not, fall back to a home-dir staging + server-side move (as `travisbriggs.com` does) or `--rsync-path="sudo rsync"`.
- **Depends on:** `gemdown`, the content collection, `rsync`, ssh access to the Gemini host.

### 7.8 Vendored front-end (`public/`)
- **Does:** the existing static front-end (index.html, css, js, Mustache template) copied verbatim from `audiodude/best-albums` into `public/`; Astro copies it into `dist/` unchanged. It fetches `/albums.json` at runtime.
- **Depends on:** nothing built here; same-origin with the generated `albums.json`.

### 7.9 Deploy (`.github/workflows/deploy.yml`)
- **Does:** on push to `main`, `npm ci && npm run build` (which runs `covers-thumbs` then `astro build` with `NODE_ENV=production`, excluding Keystatic) and deploys `dist/` to Cloudflare Pages via wrangler. Netlify is a drop-in alternative.
- **Gemini** deploys out-of-band via `npm run deploy:gem`.

## 8. `albums.json` contract

Exact key shape, matching the Rails `Album#to_legacy_dict` so the front-end is byte-compatible:

```json
{
  "albums": [
    {
      "artist": "<artist>",
      "album": "<title>",
      "link": "<link>",
      "spotify_id": "<spotifyId>",
      "photo_url_sm": "/covers/sm/<slug>.jpg",
      "photo_url_lg": "/covers/<slug>.<ext>",
      "timestamp": <Math.floor(Date.parse(added)/1000)>,
      "slug": "<slug>",
      "mini-slug": "<slug split on '-', first 4, rejoined>",
      "html": "<description markdown rendered to HTML>"
    }
  ]
}
```

Order: the endpoint sorts to match the legacy build (`Album.json` used `order('created_at')` ascending). **Verify the front-end's actual ordering when vendoring** and match it; do not assume.

## 9. Wikidata property mapping (from the Rails controller)

| Field | Wikidata path |
|---|---|
| title | `labels.en.value` |
| mbid | `claims.P436[0].mainsnak.datavalue.value` |
| spotifyId | `claims.P2205[0].mainsnak.datavalue.value` |
| artist qid | `claims.P175[0].mainsnak.datavalue.value.id` → second lookup → `labels.en.value` |
| date | `claims.P577[0].mainsnak.datavalue.value.time`, parsed `+%Y-%m-%dT%H:%M:%SZ`; on failure, fall back to the `-00` truncation the Rails code used (handles `YYYY` / `YYYY-MM`) |
| link | `https://musicbrainz.org/release-group/<mbid>` if mbid, else AllMusic `P1729`, else Amazon `P5749` |

## 10. Production data pull (one-shot)

SSH to the Rails host and dump full album records **plus resolved cover URLs** (so manually-uploaded ActiveStorage covers and `cover_url` covers are both captured):

```sh
ssh admin.bestalbumsintheuniverse.com \
  "cd /var/www/best-albums-headless/current && bin/rails runner 'puts Album.all.map { |a| \
     a.attributes.merge(cover_download_url: (a.cover.attached? ? a.cover.url : a.cover_url)) }.to_json'" \
  > scripts/data/production-albums.json
```

(Path from Capistrano `deploy_to` = `/var/www/best-albums-headless`, so the live release is `.../current`; `config/master.key` is a Capistrano linked file there.)

`import.mjs` consumes this file. `mysqldump` is a fallback but cannot resolve ActiveStorage cover URLs.

> **Manual prerequisites (maintainer must confirm before migration):**
> - SSH access to `admin.bestalbumsintheuniverse.com` per the `~/.ssh/config` block in the Rails app's README (user `best-albums-headless`, identity key).
> - The Ruby toolchain must be on `PATH` for the non-interactive SSH command — the app uses `capistrano-asdf`/`capistrano-rvm`, which a non-login shell won't auto-source. If `bin/rails` isn't found, use a login shell (`ssh -t`) or prefix the asdf/rvm shim path.

## 11. Edge cases & error handling

- **Partial release dates** (`YYYY`, `YYYY-MM`): handled by the Wikidata date fallback (§9). Not published, so low-risk.
- **Missing mbid / cover:** `new-album` proceeds with blank cover (maintainer adds one in Keystatic); `covers-thumbs` skips albums with no full cover; `albums.json` should omit or empty the photo fields gracefully.
- **Keystatic-uploaded covers:** get thumbnails via the `covers-thumbs` build prestep (not at upload time).
- **Timestamp fidelity:** preserved via full-precision `added` (§6 note); `mini-slug` and `timestamp` derived deterministically in the endpoint.
- **Slug collisions on import:** idempotent by slug; a duplicate slug overwrites (acceptable for a one-shot, re-runnable migration).

## 12. Success criteria

1. `npm run import` produces one `.md` per production album (count matches the DB), with covers downloaded.
2. The generated `dist/albums.json` has the same keys and, for the same albums, equivalent values as the current production `albums.json` (spot-diff a sample).
3. The **vendored front-end, unmodified**, renders correctly against the generated `albums.json` when `dist/` is served locally (cards, thumbnails, expand, Spotify links all work).
4. `npm run new-album <known QID>` produces a `.md` with the correct title/artist/date/mbid/spotifyId/link and a downloaded cover.
5. `npm run build:gem` produces valid `_gem/index.gmi` + per-album `.gmi` matching the old structure.
6. A production build (`NODE_ENV=production`) **excludes** the Keystatic route/integration.
7. `dist/` deploys to Cloudflare Pages and the live site behaves as it does today.

## 13. Open questions / risks

- **Front-end `timestamp` usage & ordering** — confirm exactly how `audiodude/best-albums` consumes `timestamp`/sort order when vendoring; match it in the endpoint.
- **Gemini server** — mechanism resolved: rsync via `$GEM_USER`/`$GEM_HOST` env vars + the existing passwordless `~/.ssh/config` alias (no secrets in repo). Remaining unknown: the exact remote `GEM_PATH` and whether `$GEM_USER` has write permission there (default assumption: the old `/var/gem/best-albums/`).
- **Keystatic image + Astro** — `fields.image` writing into `public/covers` is straightforward (no `astro:assets` optimization needed since the front-end consumes plain URLs); confirm the public path round-trips through Keystatic cleanly.
- **Node/sharp on the deploy host** — Cloudflare Pages build installs `sharp` for the thumbnail prestep; verify it runs in CI.
