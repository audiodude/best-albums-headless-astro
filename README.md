# best-albums-headless-astro

Local-first headless CMS for [bestalbumsintheuniverse.com](https://bestalbumsintheuniverse.com).
Albums are markdown files edited locally with [Keystatic](https://keystatic.com); the build compiles
them into a legacy-shaped `albums.json` (consumed by the existing static front-end, vendored into
`public/`) plus a [Gemini](https://geminiprotocol.net/) capsule. No database, no server to run unless
you're editing.

## Local editing

```sh
npm install
npm run dev        # http://localhost:4321  (homepage redirects to /keystatic in dev)
```

Keystatic (and React) run in dev only — they are excluded from production builds, so the deployed
site is pure static HTML + `albums.json` + cover images.

## Adding albums

- **From a Wikidata QID:** `npm run new-album <QID>` — fetches title/artist/date/MBID/Spotify/link
  and downloads the cover from Cover Art Archive, then refine the description in Keystatic.
- **By hand:** create the entry in Keystatic, or drop a `.md` into `src/content/albums/`.

Cover thumbnails are generated at build by `scripts/covers-thumbs.mjs`.

## Deploying

Push to `main` → Cloudflare Workers builds and deploys (`best-albums` project, build-on-push).
The build runs `npm run build` with `NODE_ENV=production`.

## Gemini capsule

```sh
npm run build:gem                                  # render _gem/ via gemdown
GEM_USER=<user> GEM_HOST=<host> npm run deploy:gem # rsync _gem/ to the capsule host
```

## One-shot production migration

`scripts/import.mjs` converts a production DB dump (`scripts/data/production-albums.json`) into
album `.md` files and downloads covers. See `docs/superpowers/` for the full design + plan.
