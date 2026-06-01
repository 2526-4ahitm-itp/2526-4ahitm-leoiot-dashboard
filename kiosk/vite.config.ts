import { defineConfig } from 'vite'

const isDocker = !!process.env.DOCKER_ENV
const influx  = isDocker ? 'http://influxdb:8086'       : 'http://localhost:8086'
const grafana = isDocker ? 'http://grafana:3000'         : 'http://localhost:3000'
const ws      = isDocker ? 'http://mqtt-ws-bridge:8090'  : 'http://localhost:8090'

export default defineConfig({
  server: {
    port: 8082,
    allowedHosts: true,
    proxy: {
      '/grafana': {
        target: grafana,
        changeOrigin: true,
      },
      '/influx': {
        target: influx,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/influx/, '') || '/',
      },
      '/ws': {
        target: ws,
        ws: true,
        changeOrigin: true,
      },
      '/solax': {
        target: 'https://openapi-eu.solaxcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/solax/, '') || '/',
      },
    },
  },
})
