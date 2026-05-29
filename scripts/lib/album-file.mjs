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
