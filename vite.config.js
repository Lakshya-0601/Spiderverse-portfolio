import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths so `dist/` works on GitHub Pages or any static host
  base: './',
  build: {
    // three.js alone is ~600 kB minified; that's expected for a 3D site
    chunkSizeWarningLimit: 900,
  },
});
