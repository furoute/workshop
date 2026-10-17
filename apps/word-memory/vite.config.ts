import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5273,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 5273,
  },
});
