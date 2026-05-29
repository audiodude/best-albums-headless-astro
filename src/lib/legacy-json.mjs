import { miniSlug } from './slug.mjs';

export function toLegacyDict(album, html) {
  const { data, slug } = album;
  const cover = data.cover ?? '';
  return {
    artist: data.artist,
    album: data.title,
    link: data.link ?? '',
    spotify_id: data.spotifyId ?? '',
    // Thumbnail is keyed by slug (covers-thumbs generates /covers/sm/<slug>.jpg),
    // so it is correct whether the cover path is flat (/covers/<slug>.<ext>, from
    // the scripts) or nested (/covers/<slug>/<file>, from a Keystatic upload).
    photo_url_sm: cover ? `/covers/sm/${slug}.jpg` : '',
    photo_url_lg: cover,
    timestamp: Math.floor(Date.parse(data.added) / 1000),
    slug,
    'mini-slug': miniSlug(slug),
    html,
  };
}
