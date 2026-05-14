import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const loraxPluginSrc = fileURLToPath(new URL('../../../lorax-plugin/src/index.ts', import.meta.url))
const loraxCoreRoot = fileURLToPath(new URL('../core', import.meta.url))
const loraxCoreSrc = fileURLToPath(new URL('../core/src/index.js', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: /^@lorax\/core\/src\/(.*)$/,
        replacement: `${loraxCoreRoot}/src/$1`,
      },
      {
        find: '@lorax/core',
        replacement: loraxCoreSrc,
      },
      {
        find: 'jbrowse-plugin-lorax',
        replacement: loraxPluginSrc,
      },
    ],
    dedupe: [
      'react',
      'react-dom',
      '@lorax/core',
      '@jbrowse/core',
      '@jbrowse/mobx-state-tree',
      '@jbrowse/plugin-linear-genome-view',
      '@emotion/react',
      '@emotion/styled',
      '@mui/icons-material',
      '@mui/material',
      '@mui/system',
      'mobx',
      'mobx-react',
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setupTests.js',
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
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
