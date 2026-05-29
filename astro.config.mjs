// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

const isDev = process.env.NODE_ENV !== 'production';

// Dev-only: send the homepage straight to the Keystatic editor. In production
// `/` serves the vendored front-end (public/index.html) untouched.
function devHomeToKeystatic() {
  return {
    name: 'dev-home-to-keystatic',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const path = (req.url || '').split('?')[0];
          if (path === '/' || path === '/index.html') {
            res.statusCode = 302; // never 301 — keep it uncached
            res.setHeader('Location', '/keystatic');
            res.end();
            return;
          }
          next();
        });
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://bestalbumsintheuniverse.com',
  // React is only needed for the dev-only Keystatic UI; excluding both from
  // production builds keeps dist/ free of an unused ~195KB React client bundle
  // (the vendored front-end is plain jQuery).
  integrations: isDev ? [react(), keystatic(), devHomeToKeystatic()] : [],
});
