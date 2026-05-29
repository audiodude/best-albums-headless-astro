import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parameterize, albumSlug, miniSlug } from '../src/lib/slug.mjs';

test('parameterize lowercases and dasherizes', () => {
  assert.equal(parameterize('OK Computer'), 'ok-computer');
  assert.equal(parameterize('Sigur Rós'), 'sigur-ros');
  assert.equal(parameterize('  Spaces  &  Symbols! '), 'spaces-symbols');
});

test('albumSlug joins artist + title, first 4 tokens only', () => {
  assert.equal(albumSlug('Radiohead', 'OK Computer'), 'radiohead-ok-computer');
  assert.equal(
    albumSlug('The Beatles', "Sgt. Pepper's Lonely Hearts Club Band"),
    'the-beatles-sgt-pepper',
  );
});

test('miniSlug keeps first 4 tokens', () => {
  assert.equal(miniSlug('the-beatles-sgt-pepper-s-lonely'), 'the-beatles-sgt-pepper');
  assert.equal(miniSlug('radiohead-ok-computer'), 'radiohead-ok-computer');
});
