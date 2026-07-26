import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const resolvePkg = (pkg) => path.dirname(require.resolve(`${pkg}/package.json`))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Shared UI + docs live outside this app. On Vercel (root = client-dashboard),
    // force shared deps through this package so apps/docs imports resolve.
    alias: {
      '@markova/ui': path.resolve(__dirname, '../../packages/ui'),
      'lucide-react': resolvePkg('lucide-react'),
      'react-router-dom': resolvePkg('react-router-dom'),
      react: resolvePkg('react'),
      'react-dom': resolvePkg('react-dom'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
  server: {
    port: 3001,
    fs: {
      // Shared UI + full docs site (embedded under /docs/*).
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
