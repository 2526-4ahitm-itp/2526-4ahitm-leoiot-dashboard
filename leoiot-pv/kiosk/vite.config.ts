import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { kioskMock } from './dev/mockPlugin';

export default defineConfig(({ mode }) => {
  // Werte aus process.env haben Vorrang vor .env.local
  const env = { ...loadEnv(mode, process.cwd(), 'KIOSK_'), ...process.env };
  const mock = env.KIOSK_MOCK;
  const useMock = mock !== undefined && mock !== '' && mock !== '0';

  // Weiterleitung an lokale InfluxDB und Bridge (nur ohne Mock)
  const proxy = {
    '/leogreen/api/query': {
      target: env.KIOSK_INFLUX_URL || 'http://localhost:8086',
      changeOrigin: true,
      rewrite: () => '/api/v2/query?org=leoiot',
      ...(env.KIOSK_INFLUX_TOKEN ? { headers: { Authorization: 'Token ' + env.KIOSK_INFLUX_TOKEN } } : {}),
    },
    '/leogreen/ws': {
      target: env.KIOSK_WS_URL || 'ws://localhost:8090',
      ws: true,
      changeOrigin: true,
      rewrite: () => '/ws',
    },
  };

  return {
    base: '/leogreen/',
    plugins: useMock ? [kioskMock(mock, env.KIOSK_MOCK_LIVE !== '0')] : [],
    server: { port: 8087, strictPort: true, allowedHosts: true, ...(useMock ? {} : { proxy }) },
    preview: { port: 8087, ...(useMock ? {} : { proxy }) },
    build: { outDir: 'dist', target: 'es2022' },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
