# Best Albums Headless → Astro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Rails headless CMS with a local-first Astro + Keystatic project that stores albums as markdown, compiles them into a legacy-shaped `albums.json` (for the existing vendored front-end) and a `gemdown`-rendered Gemini capsule, deployable as static files.

**Architecture:** Keystatic is a dev-only CMS that reads/writes `src/content/albums/*.md`. One shared fs-based reader (`src/lib/albums.mjs`) parses those files; an Astro static endpoint (`src/pages/albums.json.js`) compiles them to `albums.json`, and a standalone script (`scripts/build-gem.mjs`) compiles them to `.gmi`. The existing front-end is vendored into `public/` and deployed alongside the generated JSON. Standalone Node scripts replace the Rails server: `new-album` (Wikidata lookup), `import` (one-shot DB migration), `covers-thumbs` (sharp thumbnails).

**Tech Stack:** Astro 5, Keystatic (`@keystatic/astro` + `@keystatic/core`), React 19 (Keystatic dependency, excluded from production builds), `marked` (markdown→HTML), `gemdown` (markdown→gemtext), `sharp` (thumbnails), `yaml` + `zod` (frontmatter parse/validate). Tests: Node's built-in test runner (`node --test`), zero extra deps.

**Reference:** Spec at `docs/superpowers/specs/2026-05-29-best-albums-astro-design.md`. Pattern template: `~/code/vibes/null.dangerthirdrail.com`.

**Conventions:** Work on `main`. Append the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` to every commit. Run all commands from the repo root `~/code/starred/best-albums-headless-astro`.

---

## Task 1: Scaffold the Astro project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.tool-versions`
- Create: `.gitignore`
- Create: `src/env.d.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "best-albums-headless-astro",
  "type": "module",
  "version": "0.1.0",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/covers-thumbs.mjs && astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "node --test",
    "new-album": "node scripts/new-album.mjs",
    "import": "node scripts/import.mjs",
    "covers:thumbs": "node scripts/covers-thumbs.mjs",
    "build:gem": "node scripts/build-gem.mjs",
    "deploy:gem": "bash scripts/deploy-gem.sh"
  },
  "dependencies": {
    "@astrojs/react": "^4.4.2",
    "@keystatic/astro": "^5.0.6",
    "@keystatic/core": "^0.5.50",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "astro": "^5.18.1",
    "gemdown": "^0.7.0",
    "marked": "^18.0.2",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "sharp": "^0.34.4",
    "yaml": "^2.8.1",
    "zod": "^3.25.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

const isDev = process.env.NODE_ENV !== 'production';

// https://astro.build/config
export default defineConfig({
  site: 'https://bestalbumsintheuniverse.com',
  integrations: [react(), ...(isDev ? [keystatic()] : [])],
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

- [ ] **Step 4: Create `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
```

- [ ] **Step 5: Create `.tool-versions`**

```
nodejs 22.12.0
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
dist/
_gem/
.astro/
public/covers/sm/
scripts/data/
*.log
.DS_Store
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes without error; creates `node_modules/` and `package-lock.json`.

- [ ] **Step 8: Verify the dev server boots**

Run: `npm run dev` (then Ctrl-C after it prints the local URL)
Expected: Astro prints `astro ... ready` and a `http://localhost:4321` URL with no errors. (There are no pages yet; that is fine.)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src/env.d.ts .tool-versions .gitignore
git commit -m "chore: scaffold Astro + Keystatic project"
```

---

## Task 2: Keystatic config + sample fixture album

**Files:**
- Create: `keystatic.config.ts`
- Create: `src/content/albums/radiohead-ok-computer.md` (sample content used by later build verifications)
- Create: `public/covers/radiohead-ok-computer.jpg` (placeholder cover image)

- [ ] **Step 1: Create `keystatic.config.ts`**

The schema fields below are mirrored exactly by the Zod schema in Task 4. `added` is a text field holding an ISO 8601 string (Keystatic core has no datetime field); `date` is text to allow partial dates (`YYYY` / `YYYY-MM`).

```ts
import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: { kind: 'local' },
  collections: {
    albums: collection({
      label: 'Albums',
      slugField: 'title',
      path: 'src/content/albums/*',
      format: { contentField: 'description' },
      columns: ['title', 'artist'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        artist: fields.text({ label: 'Artist' }),
        added: fields.text({
          label: 'Added (ISO 8601)',
          description: 'Sort key — newest shown first. Set automatically by the import / new-album scripts.',
        }),
        date: fields.text({ label: 'Release date (YYYY / YYYY-MM / YYYY-MM-DD)' }),
        link: fields.url({ label: 'Link (MusicBrainz / AllMusic / Amazon)' }),
        spotifyId: fields.text({ label: 'Spotify album ID' }),
        mbid: fields.text({ label: 'MusicBrainz release-group ID' }),
        qid: fields.text({ label: 'Wikidata QID' }),
        cover: fields.image({
          label: 'Cover',
          directory: 'public/covers',
          publicPath: '/covers/',
        }),
        description: fields.markdoc({ label: 'Description', extension: 'md' }),
      },
    }),
  },
});
```

- [ ] **Step 2: Create the sample album `src/content/albums/radiohead-ok-computer.md`**

```markdown
---
title: OK Computer
artist: Radiohead
added: '1997-05-21T00:00:00.000Z'
date: '1997-05-21'
link: https://musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433
spotifyId: 6dVIqQ8qmQ5GBnJ9shOYGE
mbid: b1392450-e666-3926-a536-22c65f834433
qid: Q190089
cover: /covers/radiohead-ok-computer.jpg
---
A landmark album. This body text is **markdown** and becomes the `html` field
in albums.json and the gemtext description in the Gemini capsule.
```

- [ ] **Step 3: Create a placeholder cover image**

Run:
```bash
mkdir -p public/covers
printf 'placeholder' > public/covers/radiohead-ok-computer.jpg
```
Expected: file exists. (A real JPEG is not needed yet; Task 6's thumbnail test uses its own generated image. Replace with a real cover during migration.)

- [ ] **Step 4: Verify Keystatic loads**

Run: `npm run dev`, open `http://localhost:4321/keystatic`, confirm the "Albums" collection lists "OK Computer", then Ctrl-C.
Expected: the entry is visible and opens without schema errors.

- [ ] **Step 5: Commit**

```bash
git add keystatic.config.ts src/content/albums/radiohead-ok-computer.md public/covers/radiohead-ok-computer.jpg
git commit -m "feat: add Keystatic config and sample album"
```

---

## Task 3: Slug utilities (TDD)

**Files:**
- Create: `src/lib/slug.mjs`
- Test: `test/slug.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/slug.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parameterize, albumSlug, miniSlug } from '../src/lib/slug.mjs';

test('parameterize lowercases and dasherizes', () => {
  assert.equal(parameterize('OK Computer'), 'ok-computer');
  assert.equal(parameterize('Sigur Rós'), 'sigur-ros');
  assert.equal(parameterize('  Spaces  &  Symbols! '), 'spaces-symbols');
});

test('albumSlug joins artist + title, first 4 tokens only', () => {
  assert.equal(albumSlug('Radiohead', 'OK Computer'), 'radiohead-ok-computer');
  assert.equal(
    albumSlug('The Beatles', "Sgt. Pepper's Lonely Hearts Club Band"),
    'the-beatles-sgt-pepper',
  );
});

test('miniSlug keeps first 4 tokens', () => {
  assert.equal(miniSlug('the-beatles-sgt-pepper-s-lonely'), 'the-beatles-sgt-pepper');
  assert.equal(miniSlug('radiohead-ok-computer'), 'radiohead-ok-computer');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/slug.test.mjs`
Expected: FAIL — `Cannot find module '../src/lib/slug.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/slug.mjs`:
```js
// Mirrors Rails' String#parameterize (default '-' separator): transliterate
// accents away, downcase, replace runs of non-alphanumerics with '-', trim.
export function parameterize(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Album slug: "<artist> <title>" parameterized, first 4 tokens (Rails update_slug).
export function albumSlug(artist, title) {
  return parameterize(`${artist} ${title}`).split('-').slice(0, 4).join('-');
}

// mini-slug used in albums.json: first 4 tokens of an existing slug.
export function miniSlug(slug) {
  return slug.split('-').slice(0, 4).join('-');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/slug.test.mjs`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.mjs test/slug.test.mjs
git commit -m "feat: add slug utilities"
```

---

## Task 4: Album reader (TDD)

**Files:**
- Create: `src/lib/albums.mjs`
- Test: `test/albums.test.mjs`
- Test fixtures: `test/fixtures/albums/sample-a.md`, `test/fixtures/albums/sample-b.md`

- [ ] **Step 1: Create test fixtures**

`test/fixtures/albums/sample-a.md`:
```markdown
---
title: OK Computer
artist: Radiohead
added: '1997-05-21T00:00:00.000Z'
cover: /covers/radiohead-ok-computer.jpg
spotifyId: 6dVIqQ8qmQ5GBnJ9shOYGE
---
Body **A** text.
```

`test/fixtures/albums/sample-b.md`:
```markdown
---
title: Kid A
artist: Radiohead
added: '2000-10-02T00:00:00.000Z'
---
Body B text.
```

- [ ] **Step 2: Write the failing test**

`test/albums.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAlbumFile, readAllAlbums } from '../src/lib/albums.mjs';

test('parseAlbumFile splits frontmatter and body', () => {
  const raw = "---\ntitle: Kid A\nartist: Radiohead\nadded: '2000-10-02T00:00:00.000Z'\n---\nHello body.\n";
  const { slug, data, body } = parseAlbumFile(raw, 'kid-a');
  assert.equal(slug, 'kid-a');
  assert.equal(data.title, 'Kid A');
  assert.equal(data.artist, 'Radiohead');
  assert.equal(body, 'Hello body.');
});

test('parseAlbumFile throws on missing required field', () => {
  const raw = '---\ntitle: No Artist\nadded: x\n---\nbody';
  assert.throws(() => parseAlbumFile(raw, 'bad'));
});

test('readAllAlbums reads every .md in a directory', async () => {
  const albums = await readAllAlbums('test/fixtures/albums');
  const slugs = albums.map((a) => a.slug).sort();
  assert.deepEqual(slugs, ['sample-a', 'sample-b']);
  const a = albums.find((x) => x.slug === 'sample-a');
  assert.equal(a.data.spotifyId, '6dVIqQ8qmQ5GBnJ9shOYGE');
  assert.equal(a.body, 'Body **A** text.');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/albums.test.mjs`
Expected: FAIL — `Cannot find module '../src/lib/albums.mjs'`.

- [ ] **Step 4: Write minimal implementation**

`src/lib/albums.mjs`:
```js
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const albumSchema = z.object({
  title: z.string(),
  artist: z.string(),
  added: z.string(), // ISO 8601
  date: z.string().optional(),
  link: z.string().optional(),
  spotifyId: z.string().optional(),
  mbid: z.string().optional(),
  qid: z.string().optional(),
  cover: z.string().optional(),
});

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseAlbumFile(raw, slug) {
  const m = raw.match(FRONTMATTER);
  if (!m) throw new Error(`No frontmatter in ${slug}`);
  const data = albumSchema.parse(parseYaml(m[1]) ?? {});
  return { slug, data, body: m[2].trim() };
}

export async function readAllAlbums(dir = 'src/content/albums') {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const albums = [];
  for (const f of files) {
    const raw = await readFile(join(dir, f), 'utf8');
    albums.push(parseAlbumFile(raw, f.replace(/\.md$/, '')));
  }
  return albums;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/albums.test.mjs`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/albums.mjs test/albums.test.mjs test/fixtures/albums/
git commit -m "feat: add fs-based album reader with frontmatter parsing"
```

---

## Task 5: Legacy-dict mapper + albums.json endpoint (TDD)

**Files:**
- Create: `src/lib/legacy-json.mjs`
- Create: `src/pages/albums.json.js`
- Test: `test/legacy-json.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/legacy-json.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverPaths, toLegacyDict } from '../src/lib/legacy-json.mjs';

test('coverPaths derives sm path under /covers/sm with .jpg', () => {
  assert.deepEqual(coverPaths('/covers/skin.png'), {
    lg: '/covers/skin.png',
    sm: '/covers/sm/skin.jpg',
  });
  assert.deepEqual(coverPaths(undefined), { lg: '', sm: '' });
});

test('toLegacyDict produces the exact legacy key shape', () => {
  const album = {
    slug: 'radiohead-ok-computer',
    body: 'ignored here',
    data: {
      title: 'OK Computer',
      artist: 'Radiohead',
      added: '1997-05-21T00:00:00.000Z',
      link: 'https://musicbrainz.org/release-group/abc',
      spotifyId: '6dVIqQ8qmQ5GBnJ9shOYGE',
      cover: '/covers/radiohead-ok-computer.jpg',
    },
  };
  const dict = toLegacyDict(album, '<p>rendered</p>');
  assert.deepEqual(dict, {
    artist: 'Radiohead',
    album: 'OK Computer',
    link: 'https://musicbrainz.org/release-group/abc',
    spotify_id: '6dVIqQ8qmQ5GBnJ9shOYGE',
    photo_url_sm: '/covers/sm/radiohead-ok-computer.jpg',
    photo_url_lg: '/covers/radiohead-ok-computer.jpg',
    timestamp: 864172800,
    slug: 'radiohead-ok-computer',
    'mini-slug': 'radiohead-ok-computer',
    html: '<p>rendered</p>',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/legacy-json.test.mjs`
Expected: FAIL — `Cannot find module '../src/lib/legacy-json.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/legacy-json.mjs`:
```js
import { miniSlug } from './slug.mjs';

export function coverPaths(cover) {
  if (!cover) return { lg: '', sm: '' };
  const sm = cover.replace('/covers/', '/covers/sm/').replace(/\.[^.]+$/, '.jpg');
  return { lg: cover, sm };
}

export function toLegacyDict(album, html) {
  const { data, slug } = album;
  const { lg, sm } = coverPaths(data.cover);
  return {
    artist: data.artist,
    album: data.title,
    link: data.link ?? '',
    spotify_id: data.spotifyId ?? '',
    photo_url_sm: sm,
    photo_url_lg: lg,
    timestamp: Math.floor(Date.parse(data.added) / 1000),
    slug,
    'mini-slug': miniSlug(slug),
    html,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/legacy-json.test.mjs`
Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Create the endpoint `src/pages/albums.json.js`**

```js
import { marked } from 'marked';
import { readAllAlbums } from '../lib/albums.mjs';
import { toLegacyDict } from '../lib/legacy-json.mjs';

export async function GET() {
  const albums = await readAllAlbums();
  // Ascending by `added`, matching the Rails Album.json `order('created_at')`.
  albums.sort((a, b) => Date.parse(a.data.added) - Date.parse(b.data.added));
  const body = {
    albums: albums.map((a) => toLegacyDict(a, marked.parse(a.body))),
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 6: Verify the build emits a correct albums.json**

Run: `npm run build && cat dist/albums.json | npx json_pp 2>/dev/null || cat dist/albums.json`
Expected: `dist/albums.json` exists and contains an `albums` array whose single entry has keys `artist, album, link, spotify_id, photo_url_sm, photo_url_lg, timestamp, slug, mini-slug, html`, with `album: "OK Computer"` and `photo_url_sm: "/covers/sm/radiohead-ok-computer.jpg"`. (The `covers-thumbs` prestep will warn/skip the placeholder image — that is expected until Task 6.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/legacy-json.mjs src/pages/albums.json.js test/legacy-json.test.mjs
git commit -m "feat: compile albums to legacy-shaped albums.json"
```

---

## Task 6: Cover download + thumbnail pipeline (TDD)

**Files:**
- Create: `scripts/lib/covers.mjs`
- Create: `scripts/covers-thumbs.mjs`
- Test: `test/covers.test.mjs`

- [ ] **Step 1: Write the failing test (thumbnail generation)**

`test/covers.test.mjs`:
```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { resizeThumbnail } from '../scripts/lib/covers.mjs';

let dir;

test('resizeThumbnail fits within 90x80 and outputs jpeg', async () => {
  dir = await mkdtemp(join(tmpdir(), 'covers-'));
  const src = join(dir, 'src.png');
  await sharp({ create: { width: 600, height: 600, channels: 3, background: '#888' } })
    .png().toFile(src);

  const out = join(dir, 'out.jpg');
  await resizeThumbnail(src, out);

  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(meta.width <= 90 && meta.height <= 80, `got ${meta.width}x${meta.height}`);
});

after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/covers.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/covers.mjs'` (or `resizeThumbnail is not a function`).

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/covers.mjs`:
```js
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const COVERS_DIR = 'public/covers';
const UA = 'BestAlbumsBot 0.2.0 (audiodude@gmail.com)';

function extFromContentType(ct) {
  if (!ct) return null;
  if (ct.includes('jpeg')) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  return null;
}

// Downloads a remote image into public/covers/<slug>.<ext>; returns the public path.
export async function downloadCover(url, slug) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Cover ${slug}: HTTP ${res.status}`);
  const ext =
    extFromContentType(res.headers.get('content-type')) ||
    extname(new URL(url).pathname) ||
    '.jpg';
  await mkdir(COVERS_DIR, { recursive: true });
  const file = join(COVERS_DIR, `${slug}${ext}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return `/covers/${slug}${ext}`;
}

// Writes a <=90x80 (aspect-preserving) JPEG thumbnail of srcPath to outPath.
export async function resizeThumbnail(srcPath, outPath) {
  await sharp(srcPath).resize(90, 80, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(outPath);
  return outPath;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/covers.test.mjs`
Expected: PASS — 1 test, 0 failures.

- [ ] **Step 5: Create the `covers-thumbs.mjs` script**

`scripts/covers-thumbs.mjs`:
```js
import { readdir, access } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { resizeThumbnail } from './lib/covers.mjs';

const COVERS_DIR = 'public/covers';
const THUMBS_DIR = join(COVERS_DIR, 'sm');
const exists = (p) => access(p).then(() => true, () => false);

if (!(await exists(COVERS_DIR))) {
  console.log('No public/covers directory; nothing to thumbnail.');
  process.exit(0);
}

const files = (await readdir(COVERS_DIR)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const { mkdir } = await import('node:fs/promises');
await mkdir(THUMBS_DIR, { recursive: true });

let made = 0;
for (const f of files) {
  const slug = basename(f, extname(f));
  const out = join(THUMBS_DIR, `${slug}.jpg`);
  if (await exists(out)) continue;
  try {
    await resizeThumbnail(join(COVERS_DIR, f), out);
    made++;
    console.log(`thumb: ${f} -> sm/${slug}.jpg`);
  } catch (e) {
    console.warn(`skip ${f}: ${e.message}`);
  }
}
console.log(`Generated ${made} thumbnail(s).`);
```

- [ ] **Step 6: Verify the thumbnail prestep is wired into the build**

Replace the placeholder cover with a real image, then build:
```bash
sharp_create=$(cat <<'EOF'
import sharp from 'sharp';
await sharp({create:{width:500,height:500,channels:3,background:'#444'}}).jpeg().toFile('public/covers/radiohead-ok-computer.jpg');
console.log('wrote real placeholder jpeg');
EOF
)
node --input-type=module -e "$sharp_create"
npm run build
ls public/covers/sm/
```
Expected: `npm run build` runs `covers-thumbs` then `astro build`; `public/covers/sm/radiohead-ok-computer.jpg` exists.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/covers.mjs scripts/covers-thumbs.mjs test/covers.test.mjs public/covers/radiohead-ok-computer.jpg
git commit -m "feat: add cover download + sharp thumbnail pipeline"
```

---

## Task 7: Wikidata parsing (TDD)

**Files:**
- Create: `src/lib/wikidata.mjs`
- Test: `test/wikidata.test.mjs`
- Test fixture: `test/fixtures/wikidata-album.json`

- [ ] **Step 1: Create the fixture `test/fixtures/wikidata-album.json`**

A trimmed Wikidata entity shaped like `Special:EntityData/<QID>.json`'s `entities[qid]`:
```json
{
  "labels": { "en": { "language": "en", "value": "OK Computer" } },
  "claims": {
    "P436": [{ "mainsnak": { "datavalue": { "value": "b1392450-e666-3926-a536-22c65f834433" } } }],
    "P2205": [{ "mainsnak": { "datavalue": { "value": "6dVIqQ8qmQ5GBnJ9shOYGE" } } }],
    "P175": [{ "mainsnak": { "datavalue": { "value": { "id": "Q220059" } } } }],
    "P577": [{ "mainsnak": { "datavalue": { "value": { "time": "+1997-05-21T00:00:00Z" } } } }]
  }
}
```

- [ ] **Step 2: Write the failing test**

`test/wikidata.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseReleaseDate, albumLink, parseAlbumEntity, artistLabel } from '../src/lib/wikidata.mjs';

test('parseReleaseDate handles full and partial dates', () => {
  assert.equal(parseReleaseDate('+1997-05-21T00:00:00Z'), '1997-05-21');
  assert.equal(parseReleaseDate('+1997-05-00T00:00:00Z'), '1997-05');
  assert.equal(parseReleaseDate('+1997-00-00T00:00:00Z'), '1997');
  assert.equal(parseReleaseDate(undefined), undefined);
});

test('albumLink prefers MusicBrainz, then AllMusic, then Amazon', () => {
  assert.equal(albumLink('mb-id', {}), 'https://musicbrainz.org/release-group/mb-id');
  assert.equal(
    albumLink(undefined, { P1729: [{ mainsnak: { datavalue: { value: 'am-id' } } }] }),
    'https://www.allmusic.com/album/am-id',
  );
  assert.equal(
    albumLink(undefined, { P5749: [{ mainsnak: { datavalue: { value: 'az-id' } } }] }),
    'https://www.amazon.com/dp/az-id',
  );
  assert.equal(albumLink(undefined, {}), undefined);
});

test('parseAlbumEntity maps all fields from a Wikidata entity', async () => {
  const entity = JSON.parse(await readFile('test/fixtures/wikidata-album.json', 'utf8'));
  const parsed = parseAlbumEntity('Q190089', entity);
  assert.equal(parsed.qid, 'Q190089');
  assert.equal(parsed.title, 'OK Computer');
  assert.equal(parsed.mbid, 'b1392450-e666-3926-a536-22c65f834433');
  assert.equal(parsed.spotifyId, '6dVIqQ8qmQ5GBnJ9shOYGE');
  assert.equal(parsed.date, '1997-05-21');
  assert.equal(parsed.artistQid, 'Q220059');
  assert.equal(parsed.link, 'https://musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
});

test('artistLabel reads the English label', () => {
  assert.equal(artistLabel({ labels: { en: { value: 'Radiohead' } } }), 'Radiohead');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/wikidata.test.mjs`
Expected: FAIL — `Cannot find module '../src/lib/wikidata.mjs'`.

- [ ] **Step 4: Write minimal implementation**

`src/lib/wikidata.mjs`:
```js
const UA = 'BestAlbumsBot 0.2.0 (audiodude@gmail.com)';

function claimValue(claims, prop) {
  return claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

// Wikidata time like '+1997-05-21T00:00:00Z'; month/day may be '00' when unknown.
export function parseReleaseDate(timeStr) {
  if (!timeStr) return undefined;
  const m = timeStr.match(/^\+(\d{4})-(\d{2})-(\d{2})T/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  if (mo === '00') return y;
  if (d === '00') return `${y}-${mo}`;
  return `${y}-${mo}-${d}`;
}

export function albumLink(mbid, claims) {
  if (mbid) return `https://musicbrainz.org/release-group/${mbid}`;
  const allmusic = claimValue(claims, 'P1729');
  if (allmusic) return `https://www.allmusic.com/album/${allmusic}`;
  const amazon = claimValue(claims, 'P5749');
  if (amazon) return `https://www.amazon.com/dp/${amazon}`;
  return undefined;
}

export function parseAlbumEntity(qid, entity) {
  const claims = entity.claims ?? {};
  const mbid = claimValue(claims, 'P436');
  return {
    qid,
    title: entity.labels?.en?.value,
    mbid,
    spotifyId: claimValue(claims, 'P2205'),
    date: parseReleaseDate(claimValue(claims, 'P577')?.time),
    link: albumLink(mbid, claims),
    artistQid: claimValue(claims, 'P175')?.id,
  };
}

export function artistLabel(entity) {
  return entity.labels?.en?.value;
}

export async function fetchEntity(qid) {
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Wikidata ${qid}: HTTP ${res.status}`);
  const json = await res.json();
  return json.entities[qid];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/wikidata.test.mjs`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wikidata.mjs test/wikidata.test.mjs test/fixtures/wikidata-album.json
git commit -m "feat: add Wikidata entity parsing"
```

---

## Task 8: Album-file writer + new-album CLI (TDD writer, manual CLI)

**Files:**
- Create: `scripts/lib/album-file.mjs`
- Create: `scripts/new-album.mjs`
- Test: `test/album-file.test.mjs`

- [ ] **Step 1: Write the failing test (round-trip writer ↔ reader)**

`test/album-file.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAlbumMd } from '../scripts/lib/album-file.mjs';
import { parseAlbumFile } from '../src/lib/albums.mjs';

test('renderAlbumMd produces frontmatter the reader can parse back', () => {
  const data = {
    title: 'OK Computer',
    artist: 'Radiohead',
    added: '1997-05-21T00:00:00.000Z',
    spotifyId: '6dVIqQ8qmQ5GBnJ9shOYGE',
    link: undefined, // dropped
    mbid: '',        // dropped
  };
  const md = renderAlbumMd(data, 'A description.');
  const { data: parsed, body } = parseAlbumFile(md, 'radiohead-ok-computer');
  assert.equal(parsed.title, 'OK Computer');
  assert.equal(parsed.artist, 'Radiohead');
  assert.equal(parsed.spotifyId, '6dVIqQ8qmQ5GBnJ9shOYGE');
  assert.equal(parsed.link, undefined);
  assert.equal(parsed.mbid, undefined);
  assert.equal(body, 'A description.');
});

test('renderAlbumMd with empty body yields just frontmatter', () => {
  const md = renderAlbumMd({ title: 'T', artist: 'A', added: 'x' }, '');
  assert.match(md, /^---\n[\s\S]*\n---\n$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/album-file.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/album-file.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/album-file.mjs`:
```js
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

const ALBUMS_DIR = 'src/content/albums';

function stripEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export function renderAlbumMd(data, body = '') {
  const fm = stringifyYaml(stripEmpty(data)).trimEnd();
  return `---\n${fm}\n---\n${body ? body.trim() + '\n' : ''}`;
}

export async function writeAlbumMd(slug, data, body = '') {
  await mkdir(ALBUMS_DIR, { recursive: true });
  const file = join(ALBUMS_DIR, `${slug}.md`);
  await writeFile(file, renderAlbumMd(data, body));
  return file;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/album-file.test.mjs`
Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Create the `new-album.mjs` CLI**

`scripts/new-album.mjs`:
```js
import { fetchEntity, parseAlbumEntity, artistLabel } from '../src/lib/wikidata.mjs';
import { albumSlug } from '../src/lib/slug.mjs';
import { writeAlbumMd } from './lib/album-file.mjs';
import { downloadCover } from './lib/covers.mjs';

const qid = process.argv[2];
if (!qid) {
  console.error('Usage: npm run new-album <QID>   (e.g. npm run new-album Q190089)');
  process.exit(1);
}

const entity = await fetchEntity(qid);
const parsed = parseAlbumEntity(qid, entity);
if (parsed.artistQid) {
  parsed.artist = artistLabel(await fetchEntity(parsed.artistQid));
}
if (!parsed.title || !parsed.artist) {
  console.error(`Could not resolve title/artist for ${qid}. Got: ${JSON.stringify(parsed)}`);
  process.exit(1);
}

const slug = albumSlug(parsed.artist, parsed.title);

let cover;
if (parsed.mbid) {
  try {
    cover = await downloadCover(
      `https://coverartarchive.org/release-group/${parsed.mbid}/front-500`,
      slug,
    );
  } catch (e) {
    console.warn(`No cover downloaded: ${e.message}`);
  }
}

const data = {
  title: parsed.title,
  artist: parsed.artist,
  added: new Date().toISOString(),
  date: parsed.date,
  link: parsed.link,
  spotifyId: parsed.spotifyId,
  mbid: parsed.mbid,
  qid: parsed.qid,
  cover,
};

const file = await writeAlbumMd(slug, data, '');
console.log(`Wrote ${file}`);
console.log('Open Keystatic (npm run dev → /keystatic) to write the description.');
```

- [ ] **Step 6: Manual verification against a real QID** (requires network)

Run: `npm run new-album Q190089`
Expected: prints `Wrote src/content/albums/radiohead-ok-computer.md`; the file's frontmatter has `title: OK Computer`, `artist: Radiohead`, `date: '1997-05-21'`, `mbid`, `spotifyId`, `qid: Q190089`, and a `cover:` path; `public/covers/radiohead-ok-computer.jpg` is a real JPEG. Verify with: `cat src/content/albums/radiohead-ok-computer.md`.

- [ ] **Step 7: Run the full test suite**

Run: `node --test`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/album-file.mjs scripts/new-album.mjs test/album-file.test.mjs src/content/albums/radiohead-ok-computer.md public/covers/radiohead-ok-computer.jpg
git commit -m "feat: add new-album CLI (Wikidata lookup + cover download)"
```

---

## Task 9: Gemini capsule build (TDD render, manual build)

**Files:**
- Create: `src/lib/gemini.mjs`
- Create: `scripts/build-gem.mjs`
- Test: `test/gemini.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/gemini.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGemAlbum, renderGemIndex } from '../src/lib/gemini.mjs';

const album = {
  slug: 'radiohead-ok-computer',
  body: 'ignored',
  data: { title: 'OK Computer', artist: 'Radiohead', added: '1997-05-21T00:00:00.000Z', spotifyId: 'SPID' },
};

test('renderGemAlbum includes heading, spotify link, added date, body', () => {
  const out = renderGemAlbum(album, 'Gem body text.');
  assert.match(out, /^# Radiohead - OK Computer$/m);
  assert.match(out, /^=> https:\/\/open\.spotify\.com\/album\/SPID On Spotify$/m);
  assert.match(out, /^-- Added 1997-05-21 --$/m);
  assert.match(out, /Gem body text\./);
});

test('renderGemIndex lists each album as a gemtext link', () => {
  const out = renderGemIndex([album]);
  assert.match(out, /^# The Best Albums in the Universe$/m);
  assert.match(out, /^=> \/radiohead-ok-computer Radiohead - OK Computer$/m);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/gemini.test.mjs`
Expected: FAIL — `Cannot find module '../src/lib/gemini.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/gemini.mjs`:
```js
export function renderGemAlbum(album, gemBody) {
  const { data } = album;
  const lines = [`# ${data.artist} - ${data.title}`];
  if (data.spotifyId) {
    lines.push(`=> https://open.spotify.com/album/${data.spotifyId} On Spotify`);
  }
  lines.push(`-- Added ${data.added.slice(0, 10)} --`, '', gemBody.trim(), '');
  return lines.join('\n');
}

export function renderGemIndex(albums) {
  const head = [
    '# The Best Albums in the Universe',
    'Taking note of the absolute best albums in the universe of music, mostly pop and rock. A project by Travis Briggs.',
    '',
    '=> mailto:audiodude@gmail.com audiodude@gmail.com',
    '=> https://bestalbumsintheuniverse.com Visit on the www',
    '',
    'Below find all of the albums that are considered the best.',
    '',
  ];
  const items = albums.map((a) => `=> /${a.slug} ${a.data.artist} - ${a.data.title}`);
  return [...head, ...items, ''].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/gemini.test.mjs`
Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Create the `build-gem.mjs` script**

`scripts/build-gem.mjs`:
```js
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { md2gemini } from 'gemdown';
import { readAllAlbums } from '../src/lib/albums.mjs';
import { renderGemAlbum, renderGemIndex } from '../src/lib/gemini.mjs';

const OUT = '_gem';
const albums = await readAllAlbums();
// Newest first, matching the old Rake deploy_gem `order('created_at DESC')`.
albums.sort((a, b) => Date.parse(b.data.added) - Date.parse(a.data.added));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'index.gmi'), renderGemIndex(albums));

for (const a of albums) {
  const dir = join(OUT, a.slug);
  await mkdir(dir, { recursive: true });
  const gemBody = md2gemini(a.body, { renderBoldItalic: true });
  await writeFile(join(dir, 'index.gmi'), renderGemAlbum(a, gemBody));
}
console.log(`Wrote ${albums.length + 1} .gmi files to ${OUT}/`);
```

- [ ] **Step 6: Verify the Gemini build**

Run: `npm run build:gem && cat _gem/index.gmi && echo '---' && cat _gem/radiohead-ok-computer/index.gmi`
Expected: `_gem/index.gmi` lists the album as `=> /radiohead-ok-computer Radiohead - OK Computer`; the per-album file has the heading, Spotify line, `-- Added ... --`, and the description rendered as gemtext.

- [ ] **Step 7: Commit**

```bash
git add src/lib/gemini.mjs scripts/build-gem.mjs test/gemini.test.mjs
git commit -m "feat: build Gemini capsule via gemdown"
```

---

## Task 10: Gemini deploy script

**Files:**
- Create: `scripts/deploy-gem.sh`

- [ ] **Step 1: Create `scripts/deploy-gem.sh`**

```bash
#!/usr/bin/env bash
# Deploy the Gemini capsule. GEM_USER and GEM_HOST are passed per-invocation;
# the host is reached via the existing passwordless ~/.ssh/config alias.
#   GEM_USER=<user> GEM_HOST=<host> npm run deploy:gem
# GEM_PATH defaults to the legacy capsule directory.
set -euo pipefail

if [[ -z "${GEM_USER:-}" || -z "${GEM_HOST:-}" ]]; then
  echo 'Set GEM_USER and GEM_HOST env vars (host resolved via ~/.ssh/config).' >&2
  exit 1
fi
GEM_PATH="${GEM_PATH:-/var/gem/best-albums}"

npm run build:gem
rsync -az --delete _gem/ "$GEM_USER@$GEM_HOST:$GEM_PATH/"
echo "Deployed _gem/ -> $GEM_USER@$GEM_HOST:$GEM_PATH/"
```

- [ ] **Step 2: Make it executable and verify the guard**

Run:
```bash
chmod +x scripts/deploy-gem.sh
npm run deploy:gem
```
Expected: exits non-zero with `Set GEM_USER and GEM_HOST env vars` (since they are unset). This confirms the guard before any real deploy.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy-gem.sh
git commit -m "feat: add Gemini rsync deploy script"
```

> **MANUAL STEP — real Gemini deploy (do later, when ready to publish the capsule):**
> Run `GEM_USER=<your-user> GEM_HOST=<your-host> npm run deploy:gem`. Confirm the remote `GEM_PATH` (default `/var/gem/best-albums`) and that your user can write there. If not, set `GEM_PATH` to a writable dir or adjust perms. Do **not** hard-code the user/host into the repo.

---

## Task 11: Publish to GitHub + Cloudflare Pages (automated)

**Files:**
- Create: `.github/workflows/deploy.yml`

Fully automated — tokens are in `~/.secrets` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and `gh` is authenticated as `audiodude`. This task creates the Cloudflare Pages project, creates the GitHub repo, sets the Actions secrets, and pushes `main` to trigger the first deploy to `*.pages.dev`. The Cloudflare project is named **`best-albums-astro`** (→ `best-albums-astro.pages.dev`); the workflow's `--project-name` must match.

> **Run the outward-facing steps (4–8) from the main session, not a subagent** — they create a public GitHub repo + a Cloudflare project and push code. Confirm repo visibility (default `--public`, matching the existing public `audiodude/best-albums-headless`) before Step 5.
>
> **NOT automated — production go-live:** attaching the `bestalbumsintheuniverse.com` custom domain repoints production DNS off the old VPS. That is a separate, explicitly-confirmed cutover after Tasks 13–14 — see the note at the end of this task.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
        env:
          NODE_ENV: production
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=best-albums-astro
```

- [ ] **Step 2: Commit the workflow**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy static site to Cloudflare Pages on push to main"
```

- [ ] **Step 3: Create the Cloudflare Pages project (idempotent)**

```bash
set -a; . ~/.secrets; set +a
curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"name":"best-albums-astro","production_branch":"main"}' \
  -o /tmp/cf-proj.json -w 'HTTP %{http_code}\n'
node -e "const j=require('/tmp/cf-proj.json');console.log(j.success?('created '+j.result.name):JSON.stringify(j.errors))"
```
Expected: `created best-albums-astro`. If it already exists, Cloudflare returns error code `8000007` — fine (idempotent), proceed.

- [ ] **Step 4: Create the GitHub repo (no push yet) and add the remote**

```bash
gh repo create audiodude/best-albums-headless-astro --public --source=. --remote=origin
```
Expected: repo created at `github.com/audiodude/best-albums-headless-astro`; `origin` added locally. (Use `--private` instead if preferred.)

- [ ] **Step 5: Set the Actions secrets (before the first push)**

```bash
set -a; . ~/.secrets; set +a
gh secret set CLOUDFLARE_API_TOKEN  --repo audiodude/best-albums-headless-astro --body "$CLOUDFLARE_API_TOKEN"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo audiodude/best-albums-headless-astro --body "$CLOUDFLARE_ACCOUNT_ID"
```
Expected: two `✓ Set ... secret` lines. Setting secrets before pushing avoids a failed first run.

- [ ] **Step 6: Verify the production build excludes Keystatic, then push**

```bash
NODE_ENV=production npm run build
find dist -iname '*keystatic*'   # expected: no output
git push -u origin main
```
Expected: build succeeds with `dist/albums.json` and no keystatic route; the push triggers the `Deploy` workflow.

- [ ] **Step 7: Watch the deploy and verify the live site**

```bash
gh run watch --repo audiodude/best-albums-headless-astro --exit-status
```
Expected: workflow succeeds; the site is live at `https://best-albums-astro.pages.dev` serving the front-end + `/albums.json`.

> **MANUAL/CONFIRMED GO-LIVE (separate from this task):** When the `pages.dev` site is verified complete (after Tasks 13–14), attach the `bestalbumsintheuniverse.com` custom domain to the `best-albums-astro` Pages project and repoint Cloudflare DNS off the old VPS. Production cutover — do it only with explicit confirmation. Use 302 (never 301) for any redirects.

---

## Task 12: Vendor the existing front-end into `public/`

The existing front-end (`github.com/audiodude/best-albums`) is static and fetches `/albums.json`. It must be served from the same origin as the generated `albums.json`, so we vendor its assets into `public/`.

**Files:**
- Create: `public/index.html` and its assets (`public/css/**`, `public/js/**`, any templates/images), copied from the source repo.

- [ ] **Step 1: Clone the source repo to a temp location and inspect it**

Run:
```bash
git clone https://github.com/audiodude/best-albums /tmp/best-albums-frontend
find /tmp/best-albums-frontend -maxdepth 2 -type f -not -path '*/.git/*' | sort
```
Expected: lists the front-end files. Identify the static entry (`index.html`) and asset dirs (`css/`, `js/`, the Mustache template, any images). Note whether assets are at the repo root or in a subdirectory (e.g. `public/` or `_site/`).

- [ ] **Step 2: Copy the static front-end assets into `public/`**

Copy the identified files into `public/` (adjust the source paths to match what Step 1 revealed). Typical case (assets at repo root):
```bash
cp /tmp/best-albums-frontend/index.html public/index.html
cp -r /tmp/best-albums-frontend/css public/css
cp -r /tmp/best-albums-frontend/js public/js
# copy any template/image dirs the front-end references, e.g.:
# cp -r /tmp/best-albums-frontend/img public/img
```
Do **not** copy any `albums.json` from the source repo — ours is generated. Remove it if it came along: `rm -f public/albums.json`.

- [ ] **Step 3: Build and serve the full site locally**

Run:
```bash
npm run build
npm run preview
```
Open the previewed URL.
Expected: the vendored front-end loads `/albums.json` (now generated from `src/content/albums/`), and the sample album ("Radiohead — OK Computer") renders as a card with its cover thumbnail, expand behavior, and Spotify link — using the **unmodified** front-end.

- [ ] **Step 4: Verify the front-end's `timestamp`/sort usage (spec §8 open item)**

Inspect the front-end's `js/main.js` for how it uses `timestamp` and ordering:
```bash
grep -nE 'timestamp|sort|mini-slug|photo_url' public/js/main.js
```
Expected: confirm the endpoint's ascending-by-`added` sort matches the front-end's expectation. If the front-end sorts descending or by a different key, update the sort in `src/pages/albums.json.js` to match, rebuild, and re-verify Step 3.

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "feat: vendor existing static front-end into public/"
```

---

## Task 13: Production data migration

Replace the sample album with the real catalog pulled from the production database.

**Files:**
- Create: `scripts/import.mjs`
- Test: `test/import.test.mjs`
- Test fixture: `test/fixtures/production-row.json`
- Data (gitignored): `scripts/data/production-albums.json`

> **MANUAL STEP — pull the production data (maintainer):**
> Confirm SSH access to `admin.bestalbumsintheuniverse.com` (user `best-albums-headless`, key per the Rails repo README), then run:
> ```bash
> mkdir -p scripts/data
> ssh admin.bestalbumsintheuniverse.com \
>   "cd /var/www/best-albums-headless/current && bin/rails runner 'puts Album.all.map { |a| a.attributes.merge(cover_download_url: (a.cover.attached? ? a.cover.url : a.cover_url)) }.to_json'" \
>   > scripts/data/production-albums.json
> ```
> If `bin/rails` is not found over non-interactive SSH (asdf/rvm not on PATH), use `ssh -t` for a login shell or prefix the shim path. Verify the file is valid JSON: `node -e "console.log(JSON.parse(require('fs').readFileSync('scripts/data/production-albums.json')).length + ' albums')"`.

- [ ] **Step 1: Create the test fixture `test/fixtures/production-row.json`**

```json
{
  "title": "Kid A",
  "artist": "Radiohead",
  "created_at": "2000-10-02T00:00:00.000Z",
  "date": "2000-10-02",
  "link": "https://musicbrainz.org/release-group/kid-a-id",
  "spotify_id": "KIDA_SPID",
  "mbid": "kid-a-id",
  "qid": "Q207629",
  "description": "Their fourth album.",
  "cover_download_url": ""
}
```

- [ ] **Step 2: Write the failing test (pure row mapper)**

`test/import.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rowToAlbum } from '../scripts/import.mjs';

test('rowToAlbum maps a production row to {slug, data, body}', async () => {
  const row = JSON.parse(await readFile('test/fixtures/production-row.json', 'utf8'));
  row.slug = 'radiohead-kid-a'; // production slug is preserved verbatim
  const { slug, data, body } = rowToAlbum(row);
  assert.equal(slug, 'radiohead-kid-a');
  assert.equal(data.title, 'Kid A');
  assert.equal(data.artist, 'Radiohead');
  assert.equal(data.added, '2000-10-02T00:00:00.000Z');
  assert.equal(data.spotifyId, 'KIDA_SPID');
  assert.equal(data.mbid, 'kid-a-id');
  assert.equal(data.qid, 'Q207629');
  assert.equal(body, 'Their fourth album.');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/import.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/import.mjs'`.

- [ ] **Step 4: Write minimal implementation**

`scripts/import.mjs`:
```js
import { readFile } from 'node:fs/promises';
import { writeAlbumMd } from './lib/album-file.mjs';
import { downloadCover } from './lib/covers.mjs';

const SRC = 'scripts/data/production-albums.json';

// Pure mapping: production attributes row -> { slug, data, body }. No I/O.
export function rowToAlbum(row) {
  return {
    slug: row.slug, // preserve the existing production slug
    data: {
      title: row.title,
      artist: row.artist,
      added: new Date(row.created_at).toISOString(),
      date: row.date || undefined,
      link: row.link || undefined,
      spotifyId: row.spotify_id || undefined,
      mbid: row.mbid || undefined,
      qid: row.qid || undefined,
      cover: undefined, // set after download
    },
    body: (row.description || '').trim(),
  };
}

async function main() {
  const rows = JSON.parse(await readFile(SRC, 'utf8'));
  for (const row of rows) {
    const { slug, data, body } = rowToAlbum(row);
    if (row.cover_download_url) {
      try {
        data.cover = await downloadCover(row.cover_download_url, slug);
      } catch (e) {
        console.warn(`${slug}: cover failed: ${e.message}`);
      }
    }
    const file = await writeAlbumMd(slug, data, body);
    console.log(`imported ${file}`);
  }
  console.log(`Imported ${rows.length} albums.`);
}

// Run main() only when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/import.test.mjs`
Expected: PASS — 1 test, 0 failures.

- [ ] **Step 6: Run the real migration** (after the manual data pull above)

Run:
```bash
rm -f src/content/albums/radiohead-ok-computer.md   # remove the sample
npm run import
npm run build
node -e "const d=require('./dist/albums.json');console.log(d.albums.length+' albums in albums.json')"
```
Expected: one `.md` per production album under `src/content/albums/`, covers downloaded into `public/covers/`, and `dist/albums.json` contains the full catalog. Spot-check a few entries against the live `https://bestalbumsintheuniverse.com/albums.json`.

- [ ] **Step 7: Run the full test suite**

Run: `node --test`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add scripts/import.mjs test/import.test.mjs test/fixtures/production-row.json src/content/albums/ public/covers/
git commit -m "feat: migrate album catalog from production database"
```

---

## Task 14: End-to-end verification against success criteria

**Files:** none (verification only).

- [ ] **Step 1: All tests pass**

Run: `node --test`
Expected: every suite green.

- [ ] **Step 2: albums.json shape parity**

Run:
```bash
npm run build
node -e "const d=require('./dist/albums.json'); const k=Object.keys(d.albums[0]).sort(); console.log(k.join(','));"
```
Expected: `album,artist,html,link,mini-slug,photo_url_lg,photo_url_sm,slug,spotify_id,timestamp` — matching the legacy `to_legacy_dict` keys (spec §8).

- [ ] **Step 3: Front-end renders against generated data**

Run: `npm run preview`, open the URL.
Expected: the **unmodified** vendored front-end renders the full catalog with covers, thumbnails, expand behavior, and Spotify links (spec success criterion #3).

- [ ] **Step 4: Gemini capsule builds**

Run: `npm run build:gem`
Expected: `_gem/index.gmi` + one `_gem/<slug>/index.gmi` per album, valid gemtext.

- [ ] **Step 5: Production build excludes Keystatic**

Run: `NODE_ENV=production npm run build && find dist -iname '*keystatic*'`
Expected: build succeeds; no keystatic output in `dist/`.

- [ ] **Step 6: Keystatic editing works in dev**

Run: `npm run dev`, open `/keystatic`, edit an album's description, save, confirm the `.md` file changed, Ctrl-C.
Expected: edits persist to the markdown file (spec success criteria #6 / local-first editing).

- [ ] **Step 7: Final commit (if any verification produced changes)**

```bash
git add -A
git commit -m "chore: end-to-end verification of Astro + Keystatic pipeline" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** §5 layout → Tasks 1–2, 12; §6 schema → Tasks 2, 4; §7.1 Keystatic → Task 2; §7.2 reader → Task 4 (getCollection dropped in favor of shared fs reader, noted at top); §7.3 endpoint → Task 5; §7.4 covers → Task 6; §7.5 new-album → Tasks 7–8; §7.6 import → Task 13; §7.7 gemini build+deploy → Tasks 9–10; §7.8 vendored FE → Task 12; §7.9 deploy → Task 11; §8 albums.json contract → Tasks 5, 14; §9 Wikidata mapping → Task 7; §10 DB pull → Task 13 (manual); §11 edge cases → Tasks 5–7, 13; §12 success criteria → Task 14.
- **Placeholders:** none — every code/command step has concrete content. The one genuinely environment-specific value is `GEM_PATH`/front-end source layout, handled via documented manual steps.
- **Type consistency:** album object is `{slug, data, body}` throughout (Tasks 4, 5, 9, 13); `data` fields match `albumSchema` (Task 4) and `keystatic.config.ts` (Task 2); `toLegacyDict(album, html)`, `readAllAlbums(dir?)`, `renderAlbumMd(data, body)`, `resizeThumbnail(src, out)`, `downloadCover(url, slug)`, `rowToAlbum(row)` signatures are used consistently across tasks.
