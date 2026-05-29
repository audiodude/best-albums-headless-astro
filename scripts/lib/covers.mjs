import { writeFile, mkdir } from 'node:fs/promises';
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

// Writes a <=90x80 (aspect-preserving) JPEG thumbnail of srcPath to outPath.
export async function resizeThumbnail(srcPath, outPath) {
  await sharp(srcPath).resize(90, 80, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(outPath);
  return outPath;
}
