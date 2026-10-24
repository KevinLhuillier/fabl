/**
 * Taleway admin: local web app to write and publish stories.
 *
 *   npm run admin   →   http://localhost:5180
 *
 * One process serves the API (/api, with the Supabase service key from the
 * repo's .env) and the React app (Vite, with hot reload). It only listens on
 * localhost: the service key never leaves this machine.
 */
import { getRequestListener } from '@hono/node-server';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createVite } from 'vite';

import { api } from './api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.ADMIN_PORT ?? 5180);
const HOST = '127.0.0.1';

const handleApi = getRequestListener(api.fetch);
const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) {
    void handleApi(req, res);
  } else {
    vite.middlewares(req, res);
  }
});

const vite = await createVite({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  server: { middlewareMode: true, ws: { server } },
  appType: 'spa',
});

server.listen(PORT, HOST, () => {
  console.log(`\n  📚 Taleway admin  →  http://localhost:${PORT}\n`);
});
