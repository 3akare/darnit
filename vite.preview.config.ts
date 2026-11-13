// Builds the off-Reddit test page (npm run preview:build) as one self-contained HTML file.
// The Devvit SDK modules are swapped for local stand-ins; see src/preview.

import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('./src/preview'),
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@devvit/web/server': here('./src/preview/devvit-server.ts'),
      '@devvit/web/client': here('./src/preview/devvit-client.ts'),
    },
  },
  build: {
    outDir: here('./dist/preview'),
    emptyOutDir: true,
  },
});
