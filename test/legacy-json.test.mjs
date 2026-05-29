import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLegacyDict } from '../src/lib/legacy-json.mjs';

test('photo_url_sm is slug-keyed regardless of cover path shape', () => {
  const nested = {
    slug: 'a-b',
    body: '',
    data: { title: 'T', artist: 'A', added: '2024-01-01T00:00:00.000Z', cover: '/covers/a-b/orig.png' },
  };
  assert.equal(toLegacyDict(nested, '').photo_url_sm, '/covers/sm/a-b.jpg');
  assert.equal(toLegacyDict(nested, '').photo_url_lg, '/covers/a-b/orig.png');

  const noCover = {
    slug: 'x',
    body: '',
    data: { title: 'T', artist: 'A', added: '2024-01-01T00:00:00.000Z' },
  };
  assert.equal(toLegacyDict(noCover, '').photo_url_sm, '');
  assert.equal(toLegacyDict(noCover, '').photo_url_lg, '');
});

test('toLegacyDict produces the exact legacy key shape', () => {
  const album = {
    slug: 'radiohead-ok-computer',
    body: 'ignored here',
    data: {
      title: 'OK Computer',
      artist: 'Radiohead',
      added: '1997-05-21T00:00:00.000Z',
      link: 'https://musicbrainz.org/release-group/abc',
      spotifyId: '6dVIqQ8qmQ5GBnJ9shOYGE',
      cover: '/covers/radiohead-ok-computer.jpg',
    },
  };
  const dict = toLegacyDict(album, '<p>rendered</p>');
  assert.deepEqual(dict, {
    artist: 'Radiohead',
    album: 'OK Computer',
    link: 'https://musicbrainz.org/release-group/abc',
    spotify_id: '6dVIqQ8qmQ5GBnJ9shOYGE',
    photo_url_sm: '/covers/sm/radiohead-ok-computer.jpg',
    photo_url_lg: '/covers/radiohead-ok-computer.jpg',
    timestamp: 864172800,
    slug: 'radiohead-ok-computer',
    'mini-slug': 'radiohead-ok-computer',
    html: '<p>rendered</p>',
  });
});
