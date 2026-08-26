// @ts-check
import { defineConfig } from 'astro/config';

// Sitio 100% estático: Cloudflare Pages sirve `dist/` tal cual, sin adapter.
export default defineConfig({
  site: 'https://caserez.dev',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
