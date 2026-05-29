// Mirrors Rails' String#parameterize (default '-' separator): transliterate
// accents away, downcase, replace runs of non-alphanumerics with '-', trim.
export function parameterize(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Album slug: "<artist> <title>" parameterized, first 4 tokens (Rails update_slug).
export function albumSlug(artist, title) {
  return parameterize(`${artist} ${title}`).split('-').slice(0, 4).join('-');
}

// mini-slug used in albums.json: first 4 tokens of an existing slug.
export function miniSlug(slug) {
  return slug.split('-').slice(0, 4).join('-');
}
