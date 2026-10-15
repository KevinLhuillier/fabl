import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

// The web app shares code with the rest of the repo instead of copying it:
// the story format (parser/serializer) and the mobile app's color palette.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@publish': path.join(repo, 'scripts/publish/src'),
      '@mobile-theme': path.join(repo, 'apps/mobile/src/theme'),
    },
  },
  server: { fs: { allow: [repo] } },
});
