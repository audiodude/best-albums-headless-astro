import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { resizeThumbnail } from '../scripts/lib/covers.mjs';

let dir;

test('resizeThumbnail fits within 90x80 and outputs jpeg', async () => {
  dir = await mkdtemp(join(tmpdir(), 'covers-'));
  const src = join(dir, 'src.png');
  await sharp({ create: { width: 600, height: 600, channels: 3, background: '#888' } })
    .png().toFile(src);

  const out = join(dir, 'out.jpg');
  await resizeThumbnail(src, out);

  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(meta.width <= 90 && meta.height <= 80, `got ${meta.width}x${meta.height}`);
});

after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
