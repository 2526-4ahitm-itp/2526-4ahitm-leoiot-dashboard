export default {
  server: {
    allowedHosts: ["vm23.htl-leonding.ac.at"],
    proxy: {
      '/solax': {
        target: 'https://openapi-eu.solaxcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/solax/, '')
      }
    }
  }
}
