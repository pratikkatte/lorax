import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3001,
    proxy: {
      // Proxy API calls to the local backend so the browser only needs port 3001.
      // This is especially helpful when developing over SSH/remote where only 3001 is forwarded.
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Proxy Socket.IO websocket/upgrade requests to the backend.
      '/socket.io': {
        target: 'http://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
