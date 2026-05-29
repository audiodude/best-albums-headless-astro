import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAlbumFile, readAllAlbums } from '../src/lib/albums.mjs';

test('parseAlbumFile splits frontmatter and body', () => {
  const raw = "---\ntitle: Kid A\nartist: Radiohead\nadded: '2000-10-02T00:00:00.000Z'\n---\nHello body.\n";
  const { slug, data, body } = parseAlbumFile(raw, 'kid-a');
  assert.equal(slug, 'kid-a');
  assert.equal(data.title, 'Kid A');
  assert.equal(data.artist, 'Radiohead');
  assert.equal(body, 'Hello body.');
});

test('parseAlbumFile throws on missing required field', () => {
  const raw = '---\ntitle: No Artist\nadded: x\n---\nbody';
  assert.throws(() => parseAlbumFile(raw, 'bad'));
});

test('readAllAlbums reads every .md in a directory', async () => {
  const albums = await readAllAlbums('test/fixtures/albums');
  const slugs = albums.map((a) => a.slug).sort();
  assert.deepEqual(slugs, ['sample-a', 'sample-b']);
  const a = albums.find((x) => x.slug === 'sample-a');
  assert.equal(a.data.spotifyId, '6dVIqQ8qmQ5GBnJ9shOYGE');
  assert.equal(a.body, 'Body **A** text.');
});
