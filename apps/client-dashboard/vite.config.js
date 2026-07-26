import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Shared landing + waveform live outside this app (monorepo packages/ui).
    alias: {
      '@markova/ui': path.resolve(__dirname, '../../packages/ui'),
    },
  },
  server: {
    port: 3001,
    fs: {
      // packages/ui holds shared waveform + landing.
      allow: ['..', '../..'],
    },
    hmr: {
      overlay: false,
    },
    proxy: {
      // All /v1/* requests proxy to the central API Gateway (openapi.yaml contract)
      '/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // Socket.IO proxy for real-time events
      '/socket.io': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
