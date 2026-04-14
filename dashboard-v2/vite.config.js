export default {
  server: {
    allowedHosts: ["vm23.htl-leonding.ac.at"],
    proxy: {
      '/influx': {
        target: 'http://influxdb:8086',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/influx/, '')
      },
      '/solax': {
        target: 'https://openapi-eu.solaxcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/solax/, ''),
        secure: true,
        headers: {
          'Origin': 'https://openapi-eu.solaxcloud.com'
        }
      }
    }
  }
}
