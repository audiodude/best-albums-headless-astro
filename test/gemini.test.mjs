import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGemAlbum, renderGemIndex } from '../src/lib/gemini.mjs';

const album = {
  slug: 'radiohead-ok-computer',
  body: 'ignored',
  data: { title: 'OK Computer', artist: 'Radiohead', added: '1997-05-21T00:00:00.000Z', spotifyId: 'SPID' },
};

test('renderGemAlbum includes heading, spotify link, added date, body', () => {
  const out = renderGemAlbum(album, 'Gem body text.');
  assert.match(out, /^# Radiohead - OK Computer$/m);
  assert.match(out, /^=> https:\/\/open\.spotify\.com\/album\/SPID On Spotify$/m);
  assert.match(out, /^-- Added 1997-05-21 --$/m);
  assert.match(out, /Gem body text\./);
});

test('renderGemIndex lists each album as a gemtext link', () => {
  const out = renderGemIndex([album]);
  assert.match(out, /^# The Best Albums in the Universe$/m);
  assert.match(out, /^=> \/radiohead-ok-computer Radiohead - OK Computer$/m);
});
