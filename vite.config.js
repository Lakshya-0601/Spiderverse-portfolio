import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths so `dist/` works on GitHub Pages or any static host
  base: './',
  // use an assigned PORT when one is provided (e.g. by a preview tool), else Vite's default
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
  build: {
    // three.js alone is ~600 kB minified; that's expected for a 3D site
    chunkSizeWarningLimit: 900,
  },
});
