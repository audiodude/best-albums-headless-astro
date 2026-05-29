import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse as parseYaml } from 'yaml';
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

test('renderAlbumMd quotes scalars so YAML 1.1 (Keystatic) reads them as strings', () => {
  const md = renderAlbumMd(
    { title: '1989', artist: 'A', added: '2024-06-01T01:13:17.620Z', date: '1997-05-21' },
    '',
  );
  assert.match(md, /title: '1989'/);
  assert.match(md, /added: '2024-06-01T01:13:17\.620Z'/);
  assert.match(md, /date: '1997-05-21'/);
  // Under YAML 1.1 (what Keystatic uses) these must come back as strings, not Date/number.
  const fm = md.match(/^---\n([\s\S]*?)\n---/)[1];
  const v11 = parseYaml(fm, { schema: 'yaml-1.1' });
  assert.equal(typeof v11.title, 'string');
  assert.equal(typeof v11.added, 'string');
  assert.equal(typeof v11.date, 'string');
});
