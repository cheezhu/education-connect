import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      // Allow importing shared domain helpers from ../shared in dev.
      // Note: setting `server.fs.allow` overrides Vite's defaults; include the app root too,
      // otherwise Vite may 403 on normal /src/* module requests.
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../shared')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
