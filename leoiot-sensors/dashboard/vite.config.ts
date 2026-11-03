import { defineConfig } from 'vitest/config';

// Development: the page is served by Vite at http://localhost:8091/sensors/ and reaches the
// database and the broker of a local stack, the way the nginx of the image and of the host do later.
//   SENSORS_DEV_INFLUX_URL   database, default http://localhost:8086
//   SENSORS_DEV_INFLUX_TOKEN read token of that database (from the environment only, never a file)
//   SENSORS_DEV_MQTT_WS_URL  WebSocket listener of the broker, default ws://localhost:9001
const env = process.env;

const proxy = {
  '/sensors/api/query': {
    target: env.SENSORS_DEV_INFLUX_URL || 'http://localhost:8086',
    changeOrigin: true,
    rewrite: () => '/api/v2/query?org=leoiot',
    ...(env.SENSORS_DEV_INFLUX_TOKEN ? { headers: { Authorization: `Token ${env.SENSORS_DEV_INFLUX_TOKEN}` } } : {}),
  },
  '/mqtt': {
    target: env.SENSORS_DEV_MQTT_WS_URL || 'ws://localhost:9001',
    ws: true,
    changeOrigin: true,
    rewrite: () => '/',
  },
};

export default defineConfig({
  base: '/sensors/',
  server: { port: 8091, strictPort: true, proxy },
  preview: { port: 8091, strictPort: true, proxy },
  // ECharts (SVG renderer, line chart) alone is about 550 kB minified; it and the MQTT client are
  // loaded as separate files after the first paint.
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 700 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
