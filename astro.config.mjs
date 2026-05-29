// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

const isDev = process.env.NODE_ENV !== 'production';

// https://astro.build/config
export default defineConfig({
  site: 'https://bestalbumsintheuniverse.com',
  integrations: [react(), ...(isDev ? [keystatic()] : [])],
});
