import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the Vite server proxies API, uploads and websockets to Express so
// the httpOnly auth cookie stays same-origin.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // stable vendor files the browser can keep cached between app updates
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/react-dom|\/react\/|scheduler|react-router|@remix-run/.test(id)) return 'react';
          if (/socket\.io|engine\.io/.test(id)) return 'socket';
          if (/lucide-react/.test(id)) return 'icons';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
