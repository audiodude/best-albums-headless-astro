import { mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { readAllAlbums } from '../src/lib/albums.mjs';
import { resizeThumbnail } from './lib/covers.mjs';

const PUBLIC_DIR = 'public';
const THUMBS_DIR = 'public/covers/sm';
const exists = (p) => access(p).then(() => true, () => false);

const albums = await readAllAlbums();
await mkdir(THUMBS_DIR, { recursive: true });

let made = 0;
for (const album of albums) {
  const cover = album.data.cover;
  if (!cover) continue;
  const src = join(PUBLIC_DIR, cover.replace(/^\//, '')); // /covers/x.jpg -> public/covers/x.jpg
  const out = join(THUMBS_DIR, `${album.slug}.jpg`);
  if (!(await exists(src))) {
    console.warn(`skip ${album.slug}: missing ${src}`);
    continue;
  }
  if (await exists(out)) continue;
  try {
    await resizeThumbnail(src, out);
    made++;
    console.log(`thumb: ${album.slug}.jpg`);
  } catch (e) {
    console.warn(`skip ${album.slug}: ${e.message}`);
  }
}
console.log(`Generated ${made} thumbnail(s).`);
