import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * vite.config.js
 *
 * The `/api` proxy forwards all client fetch('/api/...') calls to the
 * Express server running on port 3001 during development.
 *
 * In production, Express serves the built client files directly from
 * client/dist/ so no proxy is needed.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
