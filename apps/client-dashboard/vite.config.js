import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    fs: {
      // packages/ui holds the shared waveform component.
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