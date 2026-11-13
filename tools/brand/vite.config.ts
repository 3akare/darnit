// Builds the brand image page (npm run brand). Not part of the game.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('.'),
  plugins: [viteSingleFile()],
  build: { outDir: here('../../dist/brand'), emptyOutDir: true },
});
