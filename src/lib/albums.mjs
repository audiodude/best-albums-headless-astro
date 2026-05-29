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
