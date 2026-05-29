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
  const gemBody = a.body ? md2gemini(a.body, { renderBoldItalic: true }) : '';
  await writeFile(join(dir, 'index.gmi'), renderGemAlbum(a, gemBody));
}
console.log(`Wrote ${albums.length + 1} .gmi files to ${OUT}/`);
