// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

const isDev = process.env.NODE_ENV !== 'production';

// https://astro.build/config
export default defineConfig({
  site: 'https://bestalbumsintheuniverse.com',
  // React is only needed for the dev-only Keystatic UI; excluding both from
  // production builds keeps dist/ free of an unused ~195KB React client bundle
  // (the vendored front-end is plain jQuery).
  integrations: isDev ? [react(), keystatic()] : [],
});
