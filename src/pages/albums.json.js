import { marked } from 'marked';
import { readAllAlbums } from '../lib/albums.mjs';
import { toLegacyDict } from '../lib/legacy-json.mjs';

export async function GET() {
  const albums = await readAllAlbums();
  // Ascending by `added`, matching the Rails Album.json `order('created_at')`.
  albums.sort((a, b) => Date.parse(a.data.added) - Date.parse(b.data.added));
  const body = {
    albums: albums.map((a) => toLegacyDict(a, marked.parse(a.body))),
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}
