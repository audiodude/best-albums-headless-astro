import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const COVERS_DIR = 'public/covers';
const UA = 'BestAlbumsBot 0.2.0 (audiodude@gmail.com)';

function extFromContentType(ct) {
  if (!ct) return null;
  if (ct.includes('jpeg')) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  return null;
}

// Downloads a remote image into public/covers/<slug>.<ext>; returns the public path.
export async function downloadCover(url, slug) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Cover ${slug}: HTTP ${res.status}`);
  const ext =
    extFromContentType(res.headers.get('content-type')) ||
    extname(new URL(url).pathname) ||
    '.jpg';
  await mkdir(COVERS_DIR, { recursive: true });
  const file = join(COVERS_DIR, `${slug}${ext}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return `/covers/${slug}${ext}`;
}

// Returns the public path of an already-downloaded cover for slug, or undefined.
// Lets a failed re-download fall back to the cover a previous run saved, instead
// of writing frontmatter with no `cover` field at all.
export async function existingCover(slug, dir = COVERS_DIR) {
  for (const ext of ['.jpg', '.png', '.webp']) {
    try {
      await access(join(dir, `${slug}${ext}`));
      return `/covers/${slug}${ext}`;
    } catch {}
  }
  return undefined;
}

// Writes a <=90x80 (aspect-preserving) JPEG thumbnail of srcPath to outPath.
export async function resizeThumbnail(srcPath, outPath) {
  await sharp(srcPath).resize(90, 80, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(outPath);
  return outPath;
}
