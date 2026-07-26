import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    fs: {
      // packages/ui holds the shared waveform component.
      allow: ['..', '../..'],
    },
    proxy: {
      // Pricing on the docs site reads the same public endpoint the dashboard does.
      '/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
