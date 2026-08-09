import { fetchEntity, parseAlbumEntity, artistLabel } from '../src/lib/wikidata.mjs';
import { albumSlug } from '../src/lib/slug.mjs';
import { access } from 'node:fs/promises';
import { writeAlbumMd, albumMdPath } from './lib/album-file.mjs';
import { downloadCover, existingCover } from './lib/covers.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const qid = args.find((a) => !a.startsWith('-'));
if (!qid) {
  console.error('Usage: npm run new-album <QID> [--force]   (e.g. npm run new-album Q202996)');
  console.error('  --force  overwrite an existing album (discards its description)');
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

// A rewrite drops the description body, so never overwrite without being asked.
if (!force) {
  try {
    await access(albumMdPath(slug));
    console.error(`${albumMdPath(slug)} already exists. Re-run with --force to overwrite it.`);
    process.exit(1);
  } catch {}
}

let cover;
if (parsed.mbid) {
  const coverUrl = `https://coverartarchive.org/release-group/${parsed.mbid}/front-500`;
  try {
    cover = await downloadCover(coverUrl, slug);
  } catch (e) {
    const causes = [];
    for (let c = e.cause; c; c = c.cause) {
      causes.push(c.code ? `${c.code}: ${c.message}` : c.message);
    }
    console.warn(
      `No cover downloaded from ${coverUrl}: ${[e.message, ...causes].join(' — ')}`,
    );
  }
}

// A failed fetch must not strip a cover an earlier run already saved.
cover ??= await existingCover(slug);
if (!cover) {
  console.warn(`No cover for ${slug} — add one in Keystatic or the album art will be broken.`);
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
