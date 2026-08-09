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
  // Quote scalar values (keys stay plain) so every field is an unambiguous
  // string under YAML 1.1 *and* 1.2. Keystatic parses frontmatter as YAML 1.1,
  // where an unquoted ISO date (e.g. `added`) — or a numeric title like 1989 —
  // would be read as a Date/number and fail its text-field validation.
  const fm = stringifyYaml(stripEmpty(data), {
    defaultStringType: 'QUOTE_SINGLE',
    defaultKeyType: 'PLAIN',
    lineWidth: 0,
  }).trimEnd();
  return `---\n${fm}\n---\n${body ? body.trim() + '\n' : ''}`;
}

export function albumMdPath(slug) {
  return join(ALBUMS_DIR, `${slug}.md`);
}

export async function writeAlbumMd(slug, data, body = '') {
  await mkdir(ALBUMS_DIR, { recursive: true });
  const file = albumMdPath(slug);
  await writeFile(file, renderAlbumMd(data, body));
  return file;
}
