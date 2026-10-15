import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // In development "/api" is proxied to the Express backend, so the browser
      // talks to one origin and no CORS configuration is needed locally.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true
        }
      }
    }
  }
})
