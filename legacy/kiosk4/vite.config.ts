import { defineConfig } from 'vite'

const isDocker = !!process.env.DOCKER_ENV
const influx  = isDocker ? 'http://influxdb:8086'      : 'http://localhost:8086'

export default defineConfig({
  base: isDocker ? '/kiosk4/' : '/',
  server: {
    port: 8085,
    allowedHosts: true,
    proxy: {
      '/influx': {
        target: influx,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/influx/, '') || '/',
      },
    },
  },
})
