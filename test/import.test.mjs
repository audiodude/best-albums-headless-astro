import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rowToAlbum } from '../scripts/import.mjs';

test('rowToAlbum maps a production row to {slug, data, body}', async () => {
  const row = JSON.parse(await readFile('test/fixtures/production-row.json', 'utf8'));
  row.slug = 'radiohead-kid-a'; // production slug is preserved verbatim
  const { slug, data, body } = rowToAlbum(row);
  assert.equal(slug, 'radiohead-kid-a');
  assert.equal(data.title, 'Kid A');
  assert.equal(data.artist, 'Radiohead');
  assert.equal(data.added, '2000-10-02T00:00:00.000Z');
  assert.equal(data.spotifyId, 'KIDA_SPID');
  assert.equal(data.mbid, 'kid-a-id');
  assert.equal(data.qid, 'Q207629');
  assert.equal(body, 'Their fourth album.');
});
