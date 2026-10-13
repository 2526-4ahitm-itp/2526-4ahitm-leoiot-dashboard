import { defineConfig } from 'vite'

// Local dev proxy that mirrors deploy/nginx.conf
// Run: npx vite --config vite.config.ts
// Then access everything through http://localhost:5173
export default defineConfig({
  root: './frontend',
  server: {
    port: 5173,
    allowedHosts: ['localhost', 'vm23.htl-leonding.ac.at'],
    proxy: {
      '/grafana': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/kiosk4': {
        target: 'http://localhost:8085',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kiosk4/, '') || '/',
      },
      '/kiosk3': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kiosk3/, '') || '/',
      },
      '/kiosk2': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kiosk2/, '') || '/',
      },
      '/kiosk': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kiosk/, '') || '/',
      },
      '/dashboard': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dashboard/, '') || '/',
      },
      '/influx': {
        target: 'http://localhost:8086',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/influx/, '') || '/',
      },
      '/ws': {
        target: 'http://localhost:8090',
        ws: true,
        changeOrigin: true,
      },
      '/solax': {
        target: 'https://openapi-eu.solaxcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/solax/, ''),
      },
    },
  },
})
