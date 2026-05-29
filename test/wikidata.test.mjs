import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseReleaseDate, albumLink, parseAlbumEntity, artistLabel } from '../src/lib/wikidata.mjs';

test('parseReleaseDate handles full and partial dates', () => {
  assert.equal(parseReleaseDate('+1997-05-21T00:00:00Z'), '1997-05-21');
  assert.equal(parseReleaseDate('+1997-05-00T00:00:00Z'), '1997-05');
  assert.equal(parseReleaseDate('+1997-00-00T00:00:00Z'), '1997');
  assert.equal(parseReleaseDate(undefined), undefined);
});

test('albumLink prefers MusicBrainz, then AllMusic, then Amazon', () => {
  assert.equal(albumLink('mb-id', {}), 'https://musicbrainz.org/release-group/mb-id');
  assert.equal(
    albumLink(undefined, { P1729: [{ mainsnak: { datavalue: { value: 'am-id' } } }] }),
    'https://www.allmusic.com/album/am-id',
  );
  assert.equal(
    albumLink(undefined, { P5749: [{ mainsnak: { datavalue: { value: 'az-id' } } }] }),
    'https://www.amazon.com/dp/az-id',
  );
  assert.equal(albumLink(undefined, {}), undefined);
});

test('parseAlbumEntity maps all fields from a Wikidata entity', async () => {
  const entity = JSON.parse(await readFile('test/fixtures/wikidata-album.json', 'utf8'));
  const parsed = parseAlbumEntity('Q190089', entity);
  assert.equal(parsed.qid, 'Q190089');
  assert.equal(parsed.title, 'OK Computer');
  assert.equal(parsed.mbid, 'b1392450-e666-3926-a536-22c65f834433');
  assert.equal(parsed.spotifyId, '6dVIqQ8qmQ5GBnJ9shOYGE');
  assert.equal(parsed.date, '1997-05-21');
  assert.equal(parsed.artistQid, 'Q220059');
  assert.equal(parsed.link, 'https://musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
});

test('artistLabel reads the English label', () => {
  assert.equal(artistLabel({ labels: { en: { value: 'Radiohead' } } }), 'Radiohead');
});
