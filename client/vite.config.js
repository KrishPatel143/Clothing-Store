import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['linencutandmore.aviusolutions.com', 'linencutandmoreapi.aviusolutions.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
    },
  },
});
