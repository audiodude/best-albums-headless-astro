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
    if (!slug) {
      console.warn(`skip row with no slug: ${row.title}`);
      continue;
    }
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
