// THIS CONFIG IS INACTIVE — merged into root vite.config.ts
// Uncomment and use this if running `vite` from inside frontend/ directly
// (without the root-level config that sets root: './frontend')

// import { defineConfig } from 'vite'

// export default defineConfig({
//   server: {
//     allowedHosts: ['vm23.htl-leonding.ac.at'],
//     proxy: {
//       '/grafana': {
//         target: 'http://localhost:3000',
//         changeOrigin: true,
//       },
//       '/influx': {
//         target: 'http://localhost:8086',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/influx/, ''),
//       },
//       '/ws': {
//         target: 'http://localhost:8090',
//         ws: true,
//         changeOrigin: true,
//       },
//       '/solax': {
//         target: 'https://openapi-eu.solaxcloud.com',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/solax/, ''),
//       },
//     },
//   },
// })
