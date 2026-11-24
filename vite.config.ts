import { defineConfig } from 'vite';

// Static-first: relative base so the built site works on GitHub Pages,
// Cloudflare Pages, or any static host under any path.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
