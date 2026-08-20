import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the Recipes admin island as a plain JS/CSS bundle (no HTML entry)
// that admin/index.html loads directly, mirroring how the existing vanilla-JS
// dashboard shell loads admin.js.
//
// Two output targets, selected by --mode:
// - production (default, `npm run build`): outputs to admin/recipes-dist,
//   which generate-index.js copies into dist/admin/ on every full build.
// - development (`npm run dev`, i.e. `vite build --watch --mode development`):
//   outputs directly into dist/admin/recipes-dist, so a rebuild is visible
//   to `netlify dev` (which serves the prebuilt dist/ statically — see
//   netlify.toml's [dev] block) without re-running the full site build.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, mode === 'development' ? '../dist/admin/recipes-dist' : '../admin/recipes-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.jsx'),
      output: {
        entryFileNames: 'recipes.js',
        assetFileNames: 'recipes.[ext]',
      },
    },
  },
}));
