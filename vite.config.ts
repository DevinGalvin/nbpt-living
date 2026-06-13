import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset paths — works at a domain root AND under /nbpt-living/ on Pages
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000
  }
});
