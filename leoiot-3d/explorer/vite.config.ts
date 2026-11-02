import { defineConfig } from 'vitest/config';

// Live data: the app always connects to /mqtt of its own host. In development
// the dev server forwards /mqtt to EXPLORER_MQTT_TARGET: the development broker
// of compose.dev.yaml by default, or e.g. wss://vm23.htl-leonding.ac.at.
const mqttTarget = process.env.EXPLORER_MQTT_TARGET || 'ws://localhost:9001';

export default defineConfig({
  base: '/3d/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/mqtt': { target: mqttTarget, ws: true, changeOrigin: true, secure: true },
    },
  },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
