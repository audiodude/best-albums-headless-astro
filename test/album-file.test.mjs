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
