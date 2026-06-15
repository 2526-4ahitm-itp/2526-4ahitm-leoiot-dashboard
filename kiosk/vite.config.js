import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8090',
        ws: true,
      },
    },
  },
});
