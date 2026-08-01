import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the Recipes admin island as a plain JS/CSS bundle (no HTML entry)
// that admin/index.html loads directly, mirroring how the existing vanilla-JS
// dashboard shell loads admin.js.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../admin/recipes-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.jsx'),
      output: {
        entryFileNames: 'recipes.js',
        assetFileNames: 'recipes.[ext]',
      },
    },
  },
});
