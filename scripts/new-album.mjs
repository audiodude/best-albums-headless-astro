import { fetchEntity, parseAlbumEntity, artistLabel } from '../src/lib/wikidata.mjs';
import { albumSlug } from '../src/lib/slug.mjs';
import { writeAlbumMd } from './lib/album-file.mjs';
import { downloadCover } from './lib/covers.mjs';

const qid = process.argv[2];
if (!qid) {
  console.error('Usage: npm run new-album <QID>   (e.g. npm run new-album Q202996)');
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
