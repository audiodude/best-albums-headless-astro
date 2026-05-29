export function renderGemAlbum(album, gemBody) {
  const { data } = album;
  const lines = [`# ${data.artist} - ${data.title}`];
  if (data.spotifyId) {
    lines.push(`=> https://open.spotify.com/album/${data.spotifyId} On Spotify`);
  }
  lines.push(`-- Added ${data.added.slice(0, 10)} --`, '', gemBody.trim(), '');
  return lines.join('\n');
}

export function renderGemIndex(albums) {
  const head = [
    '# The Best Albums in the Universe',
    'Taking note of the absolute best albums in the universe of music, mostly pop and rock. A project by Travis Briggs.',
    '',
    '=> mailto:audiodude@gmail.com audiodude@gmail.com',
    '=> https://bestalbumsintheuniverse.com Visit on the www',
    '',
    'Below find all of the albums that are considered the best.',
    '',
  ];
  const items = albums.map((a) => `=> /${a.slug} ${a.data.artist} - ${a.data.title}`);
  return [...head, ...items, ''].join('\n');
}
