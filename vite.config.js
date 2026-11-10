import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Dev only: POST /__shot?name=x with a JPEG data URL body writes shots/x.jpg, so exact rendered
// frames can be inspected from disk (a hidden browser pane can show stale frames).
function shotSaver() {
  return {
    name: 'shot-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const url = new URL(req.url, 'http://x');
        const name = (url.searchParams.get('name') || 'shot').replace(/[^\w-]/g, '');
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const b64 = body.slice(body.indexOf(',') + 1);
          fs.mkdirSync('shots', { recursive: true });
          fs.writeFileSync(path.join('shots', `${name}.jpg`), Buffer.from(b64, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

// GitHub Pages serves the site from /<repo>/; the deploy workflow sets VITE_BASE to that.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [shotSaver()],
  server: { port: 5173, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
