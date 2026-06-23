import { defineConfig } from 'vite'

const isDocker = !!process.env.DOCKER_ENV
const influx   = isDocker ? 'http://influxdb:8086'       : 'http://localhost:8086'
const ws       = isDocker ? 'http://mqtt-ws-bridge:8090' : 'http://localhost:8090'

export default defineConfig({
  base: isDocker ? '/leogreen/' : '/',
  server: {
    port: 8087,
    allowedHosts: true,
    proxy: {
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
    },
  },
})
