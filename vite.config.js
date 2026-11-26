import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths, so the built game runs from any folder or static host
  base: './',
  server: { port: 5173, strictPort: true, open: false },
  build: { chunkSizeWarningLimit: 3000, target: 'es2022' },
});
