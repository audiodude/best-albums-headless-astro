import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: { kind: 'local' },
  collections: {
    albums: collection({
      label: 'Albums',
      slugField: 'title',
      path: 'src/content/albums/*',
      format: { contentField: 'description' },
      columns: ['title', 'artist', 'added'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        artist: fields.text({ label: 'Artist' }),
        added: fields.text({
          label: 'Added (ISO 8601)',
          description: 'Sort key — newest shown first. Set automatically by the import / new-album scripts.',
        }),
        date: fields.text({ label: 'Release date (YYYY / YYYY-MM / YYYY-MM-DD)' }),
        link: fields.url({ label: 'Link (MusicBrainz / AllMusic / Amazon)' }),
        spotifyId: fields.text({ label: 'Spotify album ID' }),
        mbid: fields.text({ label: 'MusicBrainz release-group ID' }),
        qid: fields.text({ label: 'Wikidata QID' }),
        cover: fields.image({
          label: 'Cover',
          directory: 'public/covers',
          publicPath: '/covers/',
        }),
        description: fields.markdoc({ label: 'Description', extension: 'md' }),
      },
    }),
  },
});
