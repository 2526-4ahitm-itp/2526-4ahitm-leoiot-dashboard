import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { fixtureData } from './dev/fixturePlugin';

export default defineConfig(({ mode }) => {
  // Werte aus process.env haben Vorrang vor .env.local
  const env = { ...loadEnv(mode, process.cwd(), 'KIOSK2_'), ...process.env };
  const fixture = env.KIOSK2_FIXTURE !== undefined && env.KIOSK2_FIXTURE !== '' && env.KIOSK2_FIXTURE !== '0';

  // Weiterleitung an lokale InfluxDB und Bridge (nur ohne Testdaten)
  const proxy = {
    '/kiosk2/api/query': {
      target: env.KIOSK2_INFLUX_URL || 'http://localhost:8086',
      changeOrigin: true,
      rewrite: () => '/api/v2/query?org=leoiot',
      ...(env.KIOSK2_INFLUX_TOKEN ? { headers: { Authorization: 'Token ' + env.KIOSK2_INFLUX_TOKEN } } : {}),
    },
    '/kiosk2/ws': {
      target: env.KIOSK2_WS_URL || 'ws://localhost:8090',
      ws: true,
      changeOrigin: true,
      rewrite: () => '/ws',
    },
  };

  return {
    base: '/kiosk2/',
    plugins: fixture ? [fixtureData(env.KIOSK2_FIXTURE as string)] : [],
    // fs.allow: das gemeinsame Paket liegt in ../shared, außerhalb dieses Ordners
    server: { port: 8093, strictPort: true, allowedHosts: true, fs: { allow: ['..'] }, ...(fixture ? {} : { proxy }) },
    preview: { port: 8093, ...(fixture ? {} : { proxy }) },
    build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 900 },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
