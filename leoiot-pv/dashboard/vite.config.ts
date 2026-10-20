import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // Werte aus process.env haben Vorrang vor .env.local
  const env = { ...loadEnv(mode, process.cwd(), 'DASHBOARD_'), ...process.env };

  // Weiterleitung an lokale InfluxDB und Bridge, wie später der nginx im Container
  const proxy = {
    '/pv/api/query': {
      target: env.DASHBOARD_INFLUX_URL || 'http://localhost:8086',
      changeOrigin: true,
      rewrite: () => '/api/v2/query?org=leoiot',
      ...(env.DASHBOARD_INFLUX_TOKEN ? { headers: { Authorization: 'Token ' + env.DASHBOARD_INFLUX_TOKEN } } : {}),
    },
    '/pv/ws': {
      target: env.DASHBOARD_WS_URL || 'ws://localhost:8090',
      ws: true,
      changeOrigin: true,
      rewrite: () => '/ws',
    },
  };

  return {
    base: '/pv/',
    // fs.allow: das gemeinsame Paket liegt in ../shared, außerhalb dieses Ordners
    server: { port: 8089, strictPort: true, allowedHosts: true, fs: { allow: ['..'] }, proxy },
    preview: { port: 8089, proxy },
    build: { outDir: 'dist', target: 'es2022' },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
