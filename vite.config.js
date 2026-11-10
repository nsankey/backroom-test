import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo>/; the deploy workflow sets VITE_BASE to that.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  server: { port: 5173, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
