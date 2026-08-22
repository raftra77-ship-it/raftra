import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8005',
        changeOrigin: true
      },
      // Without this the dev server has no route for /ws, so every WebSocket the app
      // opens (agent activity feed, brand<->creator chat) silently hangs in dev while
      // working in production. `ws: true` makes Vite forward the upgrade handshake.
      '/ws': {
        target: 'ws://127.0.0.1:8005',
        ws: true,
        changeOrigin: true
      }
    }
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8005',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:8005',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
